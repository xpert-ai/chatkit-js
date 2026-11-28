import * as React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkbenchSideChat } from './useWorkbenchSideChat';
import type { WorkbenchRuntime } from '../../WorkbenchRuntime';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
const record = (id: string, purpose = 'side-chat') => ({
  thread_id: id,
  metadata: {
    purpose,
    parent_thread_id: 'source',
    forked_from_message_id: 'main-reply',
    title: id,
    titleSource: undefined as string | undefined,
    archived: undefined as boolean | undefined,
  },
  status: 'idle',
});
function setup(records: ReturnType<typeof record>[] = []) {
  let index = 0;
  const copy = vi.fn().mockImplementation(async () => ({
    thread_id: `side-${++index}`,
    metadata: { titleSource: 'default' },
  }));
  const listThreads = vi.fn().mockResolvedValue(records);
  const update = vi.fn().mockResolvedValue({});
  const remove = vi.fn().mockResolvedValue(undefined);
  const stream = {
    apiUrl: '/api/ai',
    organizationId: 'org',
    assistantId: 'assistant',
    conversationId: 'conversation',
    threadId: 'source',
    isLoading: true,
    client: {
      threads: { copy, update, delete: remove },
      conversations: { listThreads },
    },
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
  return { ...hook, stream, copy, listThreads, update, remove };
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
    expect(restored.result.current.sessions[0].inheritedMessagesEndId).toBe(
      'main-reply',
    );
  });
});

it('captures the inherited-message boundary before mounting a newly copied side chat', async () => {
  const f = setup();
  await waitFor(() => expect(f.result.current.ready).toBe(true));
  f.copy.mockResolvedValueOnce(record('side-1'));
  await act(() => f.result.current.askInSideChat());
  expect(f.result.current.sessions[0].inheritedMessagesEndId).toBe(
    'main-reply',
  );
  expect(f.copy).toHaveBeenCalledWith('source', {
    mode: 'latest-sealed-reply',
    requestId: expect.any(String),
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

it('numbers side chats from the main title, including quoted selections and closed chats', async () => {
  const f = setup();
  f.rerender({
    stream: {
      ...f.stream,
      conversation: {
        title: 'Deployment review',
      } as WorkbenchRuntime['conversation'],
    },
  });
  await waitFor(() => expect(f.result.current.ready).toBe(true));
  await act(() =>
    f.result.current.askInSideChat({
      type: 'quote',
      text: 'Selected paragraph',
    }),
  );
  expect(f.result.current.sessions[0].title).toBe('Deployment review 1');
  act(() => f.result.current.closeSideChat('side-1'));
  await act(() => f.result.current.askInSideChat());
  expect(f.result.current.sessions[1].title).toBe('Deployment review 2');
  expect(f.update).not.toHaveBeenCalled();
});

it('retains the initial label on default-title refresh, then accepts an automatic title', async () => {
  const f = setup();
  await waitFor(() => expect(f.result.current.ready).toBe(true));
  await act(() => f.result.current.askInSideChat());
  f.listThreads.mockResolvedValue([
    {
      ...record('side-1'),
      metadata: {
        ...record('side-1').metadata,
        title: 'Server default',
        titleSource: 'default',
      },
    },
  ]);
  act(() => f.result.current.reload());
  await waitFor(() => expect(f.listThreads).toHaveBeenCalledTimes(2));
  expect(f.result.current.sessions[0].title).toBe('Side chat 1');
  f.unmount();
  const restored = setup([
    {
      ...record('side-1'),
      metadata: {
        ...record('side-1').metadata,
        title: 'Server default',
        titleSource: 'default',
      },
    },
  ]);
  await waitFor(() => expect(restored.result.current.ready).toBe(true));
  expect(restored.result.current.sessions[0].title).toBe('Side chat 1');
});

it('numbers restored default titles by creation order and keeps custom titles unchanged', async () => {
  const dated = (
    id: string,
    day: string,
    titleSource: string,
    title: string,
  ) => ({
    ...record(id),
    created_at: `2026-11-${day}T00:00:00Z`,
    metadata: { ...record(id).metadata, titleSource, title },
  });
  const first = dated('first', '01', 'default', 'Side chat');
  const manual = dated('manual', '02', 'manual', 'My chosen title');
  const generated = dated('generated', '03', 'generated', 'Generated title');
  const last = dated('last', '04', 'default', 'Side chat');
  const f = setup([
    last,
    record('edit', 'message-edit'),
    generated,
    first,
    manual,
  ]);
  f.rerender({
    stream: {
      ...f.stream,
      conversation: {
        title: 'Deployment review',
      } as WorkbenchRuntime['conversation'],
    },
  });
  const titles = () =>
    Object.fromEntries(
      f.result.current.sessions.map((s) => [s.threadId, s.title]),
    );
  await waitFor(() =>
    expect(titles()).toEqual({
      first: 'Deployment review 1',
      manual: 'My chosen title',
      generated: 'Generated title',
      last: 'Deployment review 4',
    }),
  );
  await act(() => f.result.current.openSideChat('first'));
  act(() => f.result.current.closeSideChat('first'));
  const expected = titles();
  f.listThreads.mockResolvedValue([manual, first, last, generated]);
  act(() => f.result.current.reload());
  await waitFor(() =>
    expect(f.result.current.sessions.map((s) => s.threadId)).toEqual([
      'manual',
      'first',
      'last',
      'generated',
    ]),
  );
  expect(titles()).toEqual(expected);
  expect(f.update).not.toHaveBeenCalled();
});

describe('side-chat archive and delete lifecycle', () => {
  it('archives on the server, restores after reload, and reopens on unarchive', async () => {
    let records = [record('side-1')];
    const f = setup(records);
    f.listThreads.mockImplementation(async () => records);
    f.update.mockImplementation(async (id, { metadata }) => {
      records = records.map((item) =>
        item.thread_id === id
          ? { ...item, metadata: { ...item.metadata, ...metadata } }
          : item,
      );
      return records[0];
    });
    await waitFor(() => expect(f.result.current.ready).toBe(true));
    await act(() => f.result.current.openSideChat('side-1'));
    await act(() => f.result.current.archiveSideChat('side-1'));
    expect(f.update).toHaveBeenCalledWith('side-1', {
      metadata: { archived: true },
    });
    expect(f.result.current.sessions[0]).toMatchObject({
      archived: true,
      opened: false,
      visited: false,
    });
    await act(() => f.result.current.openSideChat('side-1'));
    expect(f.result.current.sessions[0].opened).toBe(false);
    f.unmount();
    const restored = setup(records);
    await waitFor(() => expect(restored.result.current.ready).toBe(true));
    expect(restored.result.current.sessions[0]).toMatchObject({
      archived: true,
      opened: false,
    });
    restored.listThreads.mockImplementation(async () => records);
    restored.update.mockImplementation(async () => {
      records = [
        {
          ...records[0],
          metadata: { ...records[0].metadata, archived: false },
        },
      ];
      return records[0];
    });
    await act(() => restored.result.current.archiveSideChat('side-1', false));
    expect(restored.update).toHaveBeenCalledWith('side-1', {
      metadata: { archived: false },
    });
    expect(restored.result.current.sessions[0]).toMatchObject({
      archived: false,
      opened: true,
      visited: true,
    });
    expect(restored.result.current.activeId).toBe('side-1');
  });

  it('keeps a failed delete intact, then deletes only the requested root and retains numbering', async () => {
    let records = ['first', 'second'].map((id) => ({
      ...record(id),
      metadata: { ...record(id).metadata, titleSource: 'default' },
    }));
    const f = setup(records);
    f.listThreads.mockImplementation(async () => records);
    await waitFor(() => expect(f.result.current.ready).toBe(true));
    await act(() => f.result.current.openSideChat('first'));
    f.remove.mockRejectedValueOnce(new Error('Delete failed'));
    await act(async () => {
      await expect(f.result.current.deleteSideChat('first')).rejects.toThrow(
        'Delete failed',
      );
    });
    expect(f.result.current.sessions[0].opened).toBe(true);
    expect(f.result.current.mutatingIds).toEqual([]);
    f.remove.mockImplementation(async (id) => {
      records = records.filter((r) => r.thread_id !== id);
    });
    await act(() => f.result.current.deleteSideChat('first'));
    expect(f.remove).toHaveBeenLastCalledWith('first');
    expect(f.result.current.sessions).toMatchObject([
      { threadId: 'second', title: 'Side chat 2', sequence: 2 },
    ]);
    f.copy.mockResolvedValueOnce({
      thread_id: 'third',
      metadata: { titleSource: 'default' },
    });
    await act(() => f.result.current.askInSideChat());
    expect(
      f.result.current.sessions.find((s) => s.threadId === 'third')?.title,
    ).toBe('Side chat 3');
    const calls = f.remove.mock.calls.length;
    await act(() => f.result.current.deleteSideChat('source'));
    expect(f.remove).toHaveBeenCalledTimes(calls);
  });

  it('ignores a stale list response arriving after archive', async () => {
    const f = setup([record('side-1')]);
    await waitFor(() => expect(f.result.current.ready).toBe(true));
    let resolve!: (value: ReturnType<typeof record>[]) => void;
    f.listThreads.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    act(() => f.result.current.reload());
    await waitFor(() => expect(f.listThreads).toHaveBeenCalledTimes(2));
    f.listThreads.mockResolvedValue([
      {
        ...record('side-1'),
        metadata: { ...record('side-1').metadata, archived: true },
      },
    ]);
    await act(() => f.result.current.archiveSideChat('side-1'));
    await act(async () => resolve([record('side-1')]));
    expect(f.result.current.sessions[0].archived).toBe(true);
  });

  it('prevents overlapping archive/delete operations and leaves the tab unchanged on failure', async () => {
    const f = setup([record('side-1')]);
    await waitFor(() => expect(f.result.current.ready).toBe(true));
    await act(() => f.result.current.openSideChat('side-1'));
    let reject!: (error: Error) => void;
    f.update.mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    let pending!: Promise<unknown>;
    act(() => {
      pending = f.result.current
        .archiveSideChat('side-1')
        .catch((error) => error);
    });
    expect(f.result.current.mutatingIds).toEqual(['side-1']);
    await act(async () => {
      await expect(f.result.current.deleteSideChat('side-1')).rejects.toThrow();
    });
    expect(f.remove).not.toHaveBeenCalled();
    await act(async () => {
      reject(new Error('Permission denied'));
      await pending;
    });
    expect(f.result.current.sessions[0]).toMatchObject({
      opened: true,
      archived: false,
    });
    expect(f.result.current.mutatingIds).toEqual([]);
  });

  it('does not apply a late restore to another conversation', async () => {
    const f = setup([
      {
        ...record('side-1'),
        metadata: { ...record('side-1').metadata, archived: true },
      },
    ]);
    await waitFor(() => expect(f.result.current.ready).toBe(true));
    let resolve!: () => void;
    f.update.mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    let pending!: Promise<void>;
    act(() => {
      pending = f.result.current.archiveSideChat('side-1', false);
    });
    f.listThreads.mockResolvedValue([]);
    f.rerender({
      stream: { ...f.stream, conversationId: 'other', threadId: 'other' },
    });
    await act(async () => {
      resolve();
      await pending;
    });
    expect(f.result.current.sessions).toEqual([]);
    expect(f.result.current.activeViewKey).toBeNull();
  });
});
