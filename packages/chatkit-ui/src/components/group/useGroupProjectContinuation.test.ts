import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  ChatGroupComposerInput,
  ChatGroupSendInput,
} from '@xpert-ai/xpert-sdk';
import { useGroupProjectContinuation } from './useGroupProjectContinuation';

const composer: ChatGroupComposerInput = {
  participantId: 'cfo',
  files: [
    {
      filePath: '/report.csv',
      workspacePath: '/report.csv',
      purpose: 'workspace',
    },
  ],
  runtimeResources: {
    revision: 1,
    resources: [{ bindingId: 'sales', version: '1' }],
  },
};
const input: ChatGroupSendInput = {
  clientMessageId: 'original-send',
  text: '@CFO review this file',
  mentions: [{ participantId: 'cfo', start: 0, end: 4 }],
  replyToMessageId: 'previous-message',
  composer,
};
const project = {
  projectId: 'project',
  name: 'Review',
  participantIds: ['cfo'],
};
function setup() {
  const onSend = vi.fn().mockResolvedValue(undefined);
  const props = {
    groupId: 'group',
    draftKey: 'original-draft',
    composer: input.composer,
    blocked: false,
    sending: false,
    onSend,
  };
  const hook = renderHook(useGroupProjectContinuation, { initialProps: props });
  return { ...hook, props, onSend };
}

describe('group Project send continuation', () => {
  it('waits for refreshed Project scope and ready resources, then preserves the original request once', () => {
    const f = setup();
    act(() => f.result.current.remember(input));
    act(() => f.result.current.ready(project));
    expect(f.onSend).not.toHaveBeenCalled();
    const refreshed = {
      ...f.props,
      composer: { ...composer, projectId: 'project' },
    };
    f.rerender({ ...refreshed, blocked: true });
    expect(f.onSend).not.toHaveBeenCalled();
    f.rerender(refreshed);
    expect(f.onSend).toHaveBeenCalledExactlyOnceWith({
      ...input,
      composer: refreshed.composer,
    });
    f.rerender({ ...refreshed, sending: true });
    f.rerender(refreshed);
    act(() => f.result.current.ready(project));
    expect(f.onSend).toHaveBeenCalledOnce();
  });
  it.each(['cancel', 'draft', 'group'] as const)(
    'does not resume after %s changes while waiting for context',
    (change) => {
      const f = setup();
      act(() => f.result.current.remember(input));
      act(() => f.result.current.ready(project));
      if (change === 'cancel') act(() => f.result.current.cancel());
      f.rerender({
        ...f.props,
        ...(change === 'draft' ? { draftKey: 'edited-draft' } : {}),
        ...(change === 'group' ? { groupId: 'another-group' } : {}),
        composer: { ...composer, projectId: 'project' },
      });
      expect(f.onSend).not.toHaveBeenCalled();
    },
  );
  it('does not send when a Project is saved without a pending send', () => {
    const f = setup();
    act(() => f.result.current.ready(project));
    f.rerender({
      ...f.props,
      composer: { ...composer, projectId: 'project' },
    });
    expect(f.onSend).not.toHaveBeenCalled();
  });
  it('resumes a multi-recipient message without introducing single-recipient composer data', () => {
    const f = setup();
    const multi: ChatGroupSendInput = {
      clientMessageId: 'multi-send',
      text: '@CFO @Funds review',
      mentions: [
        { participantId: 'cfo', start: 0, end: 4 },
        { participantId: 'funds', start: 5, end: 11 },
      ],
    };
    f.rerender({ ...f.props, composer: undefined });
    act(() => f.result.current.remember(multi));
    act(() =>
      f.result.current.ready({ ...project, participantIds: ['cfo', 'funds'] }),
    );
    expect(f.onSend).toHaveBeenCalledExactlyOnceWith(multi);
  });
});
