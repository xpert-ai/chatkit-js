import { StrictMode, type PropsWithChildren } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatDraft } from './useChatDraft';
import { draftStorageKey, readDraft, type DraftContext } from './draft-storage';
import type { ComposerPart } from '../../../lib/composer-parts';

const scope: DraftContext = {
  apiUrl: 'https://api.example.test/api/ai',
  assistantId: 'assistant',
  organizationId: 'org',
  threadId: 'branch-a',
};
const multiline = 'First line\n\n  第二行\nLast line\n';
const mount = (initialScope = scope) =>
  renderHook(({ draftContext }) => useChatDraft({ draftContext }), {
    initialProps: { draftContext: initialScope },
    wrapper: ({ children }: PropsWithChildren) => (
      <StrictMode>{children}</StrictMode>
    ),
  });
function send(hook: ReturnType<typeof mount>) {
  let submission!: ReturnType<typeof hook.result.current.beginDraftSubmission>;
  act(() => {
    submission = hook.result.current.beginDraftSubmission();
    hook.result.current.commitComposerParts([], {
      resetDom: true,
      persist: false,
    });
  });
  return submission;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('local composer drafts', () => {
  it('restores exact multiline text on a fresh mount without sending', () => {
    const first = mount();
    act(() => first.result.current.setComposerText(multiline));
    first.unmount();
    const second = mount();
    expect(second.result.current.draft).toBe(multiline);
    expect(second.result.current.renderedComposerParts).toEqual([
      { type: 'text', text: multiline },
    ]);
    expect(second.result.current.recoveredDraft).toBe(true);
  });

  it.each([
    ['thread', { threadId: 'branch-b' }],
    ['organization', { organizationId: 'other' }],
    ['assistant', { assistantId: 'other' }],
    ['service', { apiUrl: 'https://another.example.test/api/ai' }],
  ] as const)(
    'isolates %s changes and restores each selection',
    (_label, change) => {
      const hook = mount();
      act(() => hook.result.current.setComposerText('A'));
      hook.rerender({ draftContext: { ...scope, ...change } });
      expect(hook.result.current.draft).toBe('');
      act(() => hook.result.current.setComposerText('B'));
      hook.rerender({ draftContext: scope });
      expect(hook.result.current.draft).toBe('A');
    },
  );

  it('keeps each new chat in memory until a real thread ID exists', () => {
    const fresh = mount({ ...scope, threadId: null });
    act(() => fresh.result.current.setComposerText('first message'));
    expect(localStorage.length).toBe(0);
    fresh.rerender({ draftContext: scope });
    fresh.rerender({ draftContext: { ...scope, threadId: null } });
    expect(fresh.result.current.draft).toBe('');
  });

  it('moves a newly resolved submission and new input to its real branch', () => {
    const hook = mount({ ...scope, threadId: null });
    act(() => hook.result.current.setComposerText('submitted'));
    const submission = send(hook);
    act(() => hook.result.current.setComposerText('next'));
    act(() => submission.onThreadResolved('branch-a'));
    hook.rerender({ draftContext: scope });
    expect(hook.result.current.draft).toBe('next');
    act(() => submission.accept());
    hook.unmount();
    expect(mount().result.current.draft).toBe('next');
  });

  it('persists a pending send until acceptance and does not erase newer input', () => {
    const hook = mount();
    act(() => hook.result.current.setComposerText('submitted'));
    const submission = send(hook);
    expect(readDraft(draftStorageKey(scope))?.pending[0].parts).toEqual([
      { type: 'text', text: 'submitted' },
    ]);
    act(() => hook.result.current.setComposerText('next'));
    act(() => submission.accept());
    expect(hook.result.current.draft).toBe('next');
    hook.unmount();
    expect(mount().result.current.draft).toBe('next');
  });

  it('clears accepted text before stream completion and never restores it on a later error', () => {
    const hook = mount();
    act(() => hook.result.current.setComposerText('submitted'));
    const submission = send(hook);
    act(() => {
      submission.accept();
      submission.reject();
    });
    expect(localStorage.length).toBe(0);
    expect(hook.result.current.draft).toBe('');
  });

  it('recovers pending content after a reload and allows manual clearing', () => {
    const hook = mount();
    act(() => hook.result.current.setComposerText(multiline));
    send(hook);
    act(() => hook.result.current.setComposerText('next'));
    hook.unmount();
    const recovered = mount();
    expect(recovered.result.current.draft).toBe(multiline + '\nnext');
    act(() => recovered.result.current.setComposerText(''));
    recovered.unmount();
    expect(mount().result.current.draft).toBe('');
  });

  it('restores rejection with newer input once', () => {
    const hook = mount();
    act(() => hook.result.current.setComposerText('submitted'));
    const submission = send(hook);
    act(() => hook.result.current.setComposerText('next'));
    act(() => {
      submission.reject();
      submission.reject();
    });
    expect(hook.result.current.draft).toBe('submitted\nnext');
    hook.unmount();
    expect(mount().result.current.draft).toBe('submitted\nnext');
  });

  it('keeps late rejection in its original conversation', () => {
    const hook = mount();
    act(() => hook.result.current.setComposerText('A'));
    const submission = send(hook);
    hook.rerender({ draftContext: { ...scope, threadId: 'branch-b' } });
    act(() => hook.result.current.setComposerText('B'));
    act(() => submission.reject());
    expect(hook.result.current.draft).toBe('B');
    hook.rerender({ draftContext: scope });
    expect(hook.result.current.draft).toBe('A');
  });

  it('does not let an old instance acknowledgement erase replacement edits', () => {
    const hook = mount();
    act(() => hook.result.current.setComposerText('submitted'));
    const submission = send(hook);
    hook.unmount();
    const replacement = mount();
    act(() => replacement.result.current.setComposerText('edited recovery'));
    act(() => submission.accept());
    replacement.unmount();
    expect(mount().result.current.draft).toBe('edited recovery');
  });

  it('round trips thread references and capability tokens as structured parts', () => {
    const parts: ComposerPart[] = [
      { type: 'text', text: 'Read\n' },
      {
        type: 'thread',
        key: 'ref',
        reference: {
          type: 'thread',
          conversationId: 'record',
          threadId: 'branch',
          label: 'Source',
        },
      },
      {
        type: 'capability',
        key: 'skill',
        capability: {
          type: 'skill',
          id: 's',
          label: 'Skill',
          capability: { id: 's', label: 'Skill', workspaceId: 'w' },
        },
      },
    ];
    const hook = mount();
    act(() => hook.result.current.commitComposerParts(parts));
    hook.unmount();
    expect(mount().result.current.composerParts).toEqual(parts);
  });

  it('restores quote and code references, but never persists image handles', () => {
    const hook = mount();
    const quote = { type: 'quote' as const, text: 'Quoted source', id: 'q' };
    act(() =>
      hook.result.current.setDraftReferences([
        quote,
        {
          type: 'image',
          url: 'https://assets.test/private?token=secret',
          fileId: 'file',
          text: '',
        },
      ]),
    );
    expect(JSON.stringify(localStorage)).not.toContain('token=secret');
    hook.unmount();
    expect(mount().result.current.draftReferences).toEqual([quote]);
  });

  it.each([
    '{bad json',
    '{"version":2,"parts":[],"pending":[]}',
    '{"version":1,"parts":[{"type":"text","text":9}],"pending":[]}',
  ])('ignores corrupt storage %s', (value) => {
    const key = draftStorageKey(scope);
    if (!key) throw new Error('Expected a persistent draft key');
    localStorage.setItem(key, value);
    const hook = mount();
    expect(hook.result.current.draft).toBe('');
    act(() => hook.result.current.setComposerText('usable'));
    expect(hook.result.current.draft).toBe('usable');
  });

  it.each(['getItem', 'setItem', 'removeItem'] as const)(
    'survives storage %s errors',
    (method) => {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new DOMException('Denied', 'QuotaExceededError');
      });
      const hook = mount();
      act(() => hook.result.current.setComposerText('usable'));
      expect(hook.result.current.draft).toBe('usable');
      act(() => hook.result.current.setComposerText(''));
      expect(hook.result.current.draft).toBe('');
    },
  );
});
