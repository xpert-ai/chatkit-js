import * as React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkbenchSideChat } from './useWorkbenchSideChat';
import type { WorkbenchRuntime } from '../../WorkbenchRuntime';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
const record = (id: string, purpose = 'side-chat') => ({
  thread_id: id,
  metadata: { purpose, parent_thread_id: 'source', title: id },
  status: 'idle',
});
function setup(records: ReturnType<typeof record>[] = []) {
  let index = 0;
  const copy = vi
    .fn()
    .mockImplementation(async () => ({
      thread_id: `side-${++index}`,
      metadata: { titleSource: 'default' },
    }));
  const listThreads = vi.fn().mockResolvedValue(records);
  const update = vi.fn().mockResolvedValue({});
  const stream = {
    apiUrl: '/api/ai',
    organizationId: 'org',
    assistantId: 'assistant',
    conversationId: 'conversation',
    threadId: 'source',
    isLoading: true,
    client: { threads: { copy, update }, conversations: { listThreads } },
  } as unknown as WorkbenchRuntime;
  const hook = renderHook(
    ({ stream }) => {
      const [activeViewKey, setActiveViewKey] = React.useState<string | null>(
        null,
      );
      const { t } = useChatkitTranslation();
      return {
        ...useWorkbenchSideChat({
          stream,
          sideChatEnabled: true,
          t,
          activeViewKey,
          setActiveViewKey,
          setOpen: vi.fn(),
        }),
        activeViewKey,
      };
    },
    { initialProps: { stream } },
  );
  return { ...hook, stream, copy, listThreads, update };
}
beforeEach(() => localStorage.clear());
describe('multiple side chats', () => {
  it('creates three independent children and reopens a closed tab without another copy', async () => {
    const f = setup();
    await waitFor(() => expect(f.result.current.ready).toBe(true));
    for (let i = 0; i < 3; i++)
      await act(() =>
        f.result.current.askInSideChat({ type: 'quote', text: `quote ${i}` }),
      );
    expect(f.result.current.sessions.map((s) => s.threadId)).toEqual([
      'side-1',
      'side-2',
      'side-3',
    ]);
    expect(
      new Set(f.copy.mock.calls.map((call) => call[1].requestId)).size,
    ).toBe(3);
    act(() => f.result.current.closeSideChat('side-2'));
    expect(f.result.current.sessions[1].opened).toBe(false);
    await act(() => f.result.current.openSideChat('side-2'));
    expect(f.result.current.sessions[1].opened).toBe(true);
    expect(f.copy).toHaveBeenCalledTimes(3);
    expect(f.stream.isLoading).toBe(true);
  });
  it('retries a lost response with the same request identity', async () => {
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
  it('deduplicates overlapping creation and retains both references', async () => {
    const f = setup();
    let resolve!: (value: { thread_id: string }) => void;
    f.copy.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    let pending!: Promise<void[]>;
    act(() => {
      pending = Promise.all(
        ['one', 'two'].map((text) =>
          f.result.current.askInSideChat({ type: 'quote', text }),
        ),
      );
    });
    expect(f.copy).toHaveBeenCalledOnce();
    await act(async () => {
      resolve({ thread_id: 'side-1' });
      await pending;
    });
    expect(
      f.result.current.sessions[0].referenceRequest?.references,
    ).toHaveLength(2);
  });
  it('never lets a late creation steal focus after navigating away and back', async () => {
    const f = setup();
    let resolve!: (value: { thread_id: string }) => void;
    f.copy.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    let pending!: Promise<void>;
    act(() => {
      pending = f.result.current.askInSideChat();
    });
    f.rerender({
      stream: { ...f.stream, conversationId: 'other', threadId: 'other' },
    });
    f.rerender({ stream: f.stream });
    await act(async () => {
      resolve({ thread_id: 'late' });
      await pending;
    });
    expect(f.result.current.activeViewKey).toBeNull();
  });
  it('restores authorized side chats, filtering ordinary editing branches', async () => {
    const f = setup();
    await waitFor(() => expect(f.result.current.ready).toBe(true));
    await act(() => f.result.current.askInSideChat());
    const saved = localStorage.getItem(
      'chatkit:side-chats:v1:["/api/ai","org",null,"assistant",null,"conversation"]',
    );
    expect(saved).toContain('side-1');
    f.listThreads.mockResolvedValue([
      record('side-1'),
      record('edit', 'message-edit'),
    ]);
    act(() => f.result.current.reload());
    await waitFor(() => expect(f.listThreads).toHaveBeenCalledTimes(2));
    expect(f.result.current.sessions).toHaveLength(1);
    f.unmount();
    const restored = setup([record('side-1')]);
    await waitFor(() =>
      expect(restored.result.current.sessions[0]?.opened).toBe(true),
    );
  });
});

it('clears mounted side chats when access is revoked', async () => {
  const f = setup();
  await waitFor(() => expect(f.result.current.ready).toBe(true));
  await act(() => f.result.current.askInSideChat());
  f.listThreads.mockRejectedValue(
    Object.assign(new Error('Forbidden'), { status: 403 }),
  );
  act(() => f.result.current.reload());
  await waitFor(() => expect(f.result.current.error).toBe('Forbidden'));
  expect(f.result.current.sessions).toEqual([]);
});

it('keeps a temporary label without treating creation as a manual rename', async () => {
  const f = setup();
  await waitFor(() => expect(f.result.current.ready).toBe(true));
  await act(() => f.result.current.askInSideChat());
  expect(f.update).not.toHaveBeenCalled();
  expect(f.result.current.sessions[0].title).toBe('Side chat 1');
  await act(() => f.result.current.renameSideChat('side-1', 'My chosen title'));
  expect(f.update).toHaveBeenCalledWith('side-1', {
    metadata: { title: 'My chosen title' },
  });
  expect(f.copy).toHaveBeenCalledOnce();
});

it('refreshes the generated title on completion and preserves the active tab', async () => {
  const f = setup([record('side-1')]);
  await waitFor(() => expect(f.result.current.ready).toBe(true));
  await act(() => f.result.current.openSideChat('side-1'));
  const active = f.result.current.activeViewKey;
  act(() => f.result.current.updateStatus('side-1', 'busy'));
  f.listThreads.mockResolvedValue([
    {
      ...record('side-1'),
      metadata: {
        ...record('side-1').metadata,
        title: 'Compare deployment options',
      },
    },
  ]);
  act(() => f.result.current.updateStatus('side-1', 'idle'));
  await waitFor(() =>
    expect(f.result.current.sessions[0].title).toBe(
      'Compare deployment options',
    ),
  );
  expect(f.result.current.activeViewKey).toBe(active);
  expect(f.result.current.sessions[0].opened).toBe(true);
});

it('keeps labels working on servers without automatic-title support', async () => {
  const f = setup();
  await waitFor(() => expect(f.result.current.ready).toBe(true));
  f.copy.mockResolvedValueOnce({ thread_id: 'legacy', metadata: {} });
  await act(() => f.result.current.askInSideChat());
  expect(f.update).toHaveBeenCalledWith('legacy', {
    metadata: { title: 'Side chat 1' },
  });
});
