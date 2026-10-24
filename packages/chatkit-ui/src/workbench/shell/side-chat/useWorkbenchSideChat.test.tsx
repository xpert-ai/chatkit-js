import * as React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWorkbenchSideChat } from './useWorkbenchSideChat';
import type { WorkbenchRuntime } from '../../WorkbenchRuntime';
import type { SideChatSession } from '../../side-chat/types';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';

function setup() {
  const copy = vi.fn().mockResolvedValue({ thread_id: 'side-1' });
  const stream = {
    apiUrl: '/api/ai',
    organizationId: 'org',
    assistantId: 'assistant',
    conversationId: 'conversation',
    threadId: 'source',
    isLoading: true,
    client: { threads: { copy } },
  } as unknown as WorkbenchRuntime;
  const hook = renderHook(
    ({ stream }) => {
      const [sideChat, setSideChat] = React.useState<SideChatSession | null>(
        null,
      );
      const [opening, setSideChatOpening] = React.useState(false);
      const [, setActiveViewKey] = React.useState<string | null>(null);
      const [, setCloseDialog] = React.useState(false);
      const [, setConfirmationDisabled] = React.useState(false);
      const { t } = useChatkitTranslation();
      const actions = useWorkbenchSideChat({
        stream,
        sideChatEnabled: true,
        t,
        setActiveViewKey,
        setOpen: vi.fn(),
        setSideChatOpening,
        setSideChat,
        sideChat,
        setSideChatCloseDialogOpen: setCloseDialog,
        adjacentTab: () => '',
        closeWorkbench: vi.fn(),
        sideChatCloseConfirmationDisabled: true,
        setSideChatCloseConfirmationDisabled: setConfirmationDisabled,
      });
      return { ...actions, sideChat, opening };
    },
    { initialProps: { stream } },
  );
  return { ...hook, stream, copy };
}

describe('side chat creation', () => {
  it('keeps the creation identity after a rejected response, then reuses the child while running', async () => {
    const f = setup();
    f.copy.mockRejectedValueOnce(
      Object.assign(new Error('HTTP 409: raw payload'), {
        status: 409,
        text: JSON.stringify({
          code: 'side_chat_checkpoint_unavailable',
          message: 'No completed reply yet',
        }),
      }),
    );
    await act(async () => {
      await expect(
        f.result.current.askInSideChat({ type: 'quote', text: 'keep this' }),
      ).rejects.toThrow('No completed reply yet');
    });
    expect(f.result.current.sideChat).toBeNull();
    await act(() =>
      f.result.current.askInSideChat({ type: 'quote', text: 'keep this' }),
    );
    expect(f.copy.mock.calls[1]).toEqual(f.copy.mock.calls[0]);
    expect(f.copy.mock.calls[0]).toEqual([
      'source',
      {
        mode: 'latest-sealed-reply',
        requestId: expect.any(String),
      },
    ]);
    expect(f.result.current.sideChat?.referenceRequest?.reference).toEqual({
      type: 'quote',
      text: 'keep this',
    });
    await act(() => f.result.current.askInSideChat());
    expect(f.copy).toHaveBeenCalledTimes(2);
    expect(f.stream.isLoading).toBe(true);
  });

  it('retries an unknown network outcome with the same identity', async () => {
    const f = setup();
    f.copy.mockRejectedValueOnce(new Error('Response lost'));
    await act(async () => {
      await expect(f.result.current.askInSideChat()).rejects.toThrow(
        'Response lost',
      );
    });
    await act(() => f.result.current.askInSideChat());
    expect(f.copy.mock.calls[1]).toEqual(f.copy.mock.calls[0]);
  });

  it('deduplicates overlapping entry points and uses a new identity only after explicit close', async () => {
    const f = setup();
    let resolve: (value: { thread_id: string }) => void;
    f.copy.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    let first: Promise<void>;
    let second: Promise<void>;
    act(() => {
      first = f.result.current.askInSideChat();
      second = f.result.current.askInSideChat({
        type: 'quote',
        text: 'selection',
      });
    });
    expect(f.copy).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve!({ thread_id: 'side-1' });
      await Promise.all([first, second]);
    });
    const original = f.copy.mock.calls[0][1].requestId;
    act(() => f.result.current.requestCloseSideChat());
    await act(() => f.result.current.askInSideChat());
    expect(f.copy).toHaveBeenCalledTimes(2);
    expect(f.copy.mock.calls[1][1].requestId).not.toBe(original);
  });

  it('does not mount a late fork into another source and can reuse it on return', async () => {
    const f = setup();
    let resolve: (value: { thread_id: string }) => void;
    f.copy.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    let pending: Promise<void>;
    act(() => {
      pending = f.result.current.askInSideChat();
    });
    f.rerender({ stream: { ...f.stream, threadId: 'another-source' } });
    await act(async () => {
      resolve!({ thread_id: 'side-1' });
      await pending;
    });
    expect(f.result.current.sideChat).toBeNull();
    expect(f.result.current.opening).toBe(false);
    f.rerender({ stream: f.stream });
    await act(() => f.result.current.askInSideChat());
    expect(f.result.current.sideChat?.threadId).toBe('side-1');
    expect(f.copy).toHaveBeenCalledTimes(1);
  });
});
