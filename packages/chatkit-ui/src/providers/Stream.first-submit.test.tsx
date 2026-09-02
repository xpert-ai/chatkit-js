import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdkMocks = vi.hoisted(() => ({
  threadsCreate: vi.fn(),
  threadsDelete: vi.fn(),
  conversationsCreate: vi.fn(),
  conversationsGet: vi.fn(),
  conversationsSearchMessages: vi.fn(),
  runsStream: vi.fn(),
}));
const queryState = vi.hoisted(() => ({ value: null as string | null }));

vi.mock('@xpert-ai/xpert-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xpert-ai/xpert-sdk')>();

  class Client {
    threads = {
      create: sdkMocks.threadsCreate,
      delete: sdkMocks.threadsDelete,
    };

    conversations = {
      create: sdkMocks.conversationsCreate,
      get: sdkMocks.conversationsGet,
      searchMessages: sdkMocks.conversationsSearchMessages,
    };

    runs = {
      stream: sdkMocks.runsStream,
    };
  }

  return { ...actual, Client };
});

vi.mock('nuqs', async () => {
  const react = await import('react');
  return {
    useQueryState: () => {
      const [value, setValue] = react.useState<string | null>(queryState.value);
      const setQueryValue = react.useCallback((next: string | null) => {
        queryState.value = next;
        setValue(next);
      }, []);
      return [value, setQueryValue] as const;
    },
  };
});

vi.mock('../hooks/useParentMessenger', () => ({
  useParentMessenger: () => ({
    isParentAvailable: false,
    sendCommand: vi.fn(),
    sendEvent: vi.fn(),
  }),
}));

vi.mock('./runtime-activities', () => ({
  logRuntimeActivity: vi.fn(),
  useRuntimeActivities: () => ({
    runtimeActivities: {},
    clearRuntimeActivities: vi.fn(),
    refreshSandboxServices: vi.fn(),
    handleRuntimeActivityTrigger: vi.fn(),
    stopRuntimeActivityItem: vi.fn(),
  }),
}));

import {
  StreamProvider,
  useStreamContext,
  type StreamContextType,
} from './Stream';

let latestStream: StreamContextType | null = null;

function StreamProbe() {
  latestStream = useStreamContext();
  return null;
}

function getStream() {
  if (!latestStream) {
    throw new Error('Stream context is not ready');
  }
  return latestStream;
}

function streamProvider(xpertId = 'xpert-1', projectId = 'project-1') {
  return (
    <StreamProvider
      apiKey="cs-x-test"
      apiUrl="https://api.example.test/api/ai"
      xpertId={xpertId}
      projectId={projectId}
    >
      <StreamProbe />
    </StreamProvider>
  );
}

function renderStream() {
  latestStream = null;
  return render(streamProvider());
}

function optimisticFirstMessage() {
  return {
    optimisticValues: (previous: {
      messages: StreamContextType['messages'];
    }) => ({
      messages: [
        ...previous.messages,
        { id: 'optimistic-1', type: 'human', content: 'Hello' },
      ],
    }),
  };
}

describe('first submission setup', () => {
  beforeEach(() => {
    queryState.value = null;
    sdkMocks.threadsCreate.mockReset();
    sdkMocks.threadsDelete.mockReset();
    sdkMocks.conversationsCreate.mockReset();
    sdkMocks.conversationsGet.mockReset();
    sdkMocks.conversationsSearchMessages.mockReset();
    sdkMocks.runsStream.mockReset();
    sdkMocks.threadsDelete.mockResolvedValue(undefined);
    sdkMocks.conversationsGet.mockResolvedValue({
      id: 'conversation-1',
      threadId: 'thread-1',
      status: 'idle',
    });
    sdkMocks.conversationsSearchMessages.mockResolvedValue({
      items: [],
      total: 0,
    });
    sdkMocks.runsStream.mockImplementation(async function* () {
      yield* [];
    });
  });

  it('atomically clears the previous thread when the assistant or Project scope changes', async () => {
    const { rerender } = renderStream();

    await act(async () => {
      getStream().reset('thread-project-1', [
        { id: 'message-1', type: 'human', content: 'Project 1 secret' },
      ]);
      await getStream().setConnectorBindingIds(['connector-1']);
    });
    expect(queryState.value).toBe('thread-project-1');
    expect(getStream().messages).toHaveLength(1);

    rerender(streamProvider('xpert-2', 'project-2'));

    await waitFor(() => {
      expect(getStream().threadId).toBeNull();
      expect(getStream().messages).toEqual([]);
      expect(getStream().connectorBindingIds).toEqual([]);
    });
    expect(queryState.value).toBeNull();
  });

  it('aborts an active run before replacing its assistant and Project scope', async () => {
    sdkMocks.threadsCreate.mockResolvedValue({
      thread_id: 'thread-project-1',
      metadata: { id: 'conversation-project-1' },
    });
    sdkMocks.conversationsCreate.mockResolvedValue({
      id: 'conversation-project-1',
      threadId: 'thread-project-1',
    });
    let runSignal: AbortSignal | null = null;
    sdkMocks.runsStream.mockImplementation(
      (
        _threadId: string,
        _assistantId: string,
        options: { signal: AbortSignal },
      ) => {
        runSignal = options.signal;
        return (async function* () {
          await new Promise<void>((resolve) => {
            if (options.signal.aborted) {
              resolve();
              return;
            }
            options.signal.addEventListener('abort', () => resolve(), {
              once: true,
            });
          });
          if (!options.signal.aborted) yield undefined;
        })();
      },
    );
    const { rerender } = renderStream();

    let submission!: Promise<void>;
    act(() => {
      submission = getStream().submit(
        { input: { input: 'Keep running' } },
        optimisticFirstMessage(),
      );
    });
    await waitFor(() => {
      expect(runSignal).not.toBeNull();
      expect(getStream().isLoading).toBe(true);
    });

    rerender(streamProvider('xpert-2', 'project-2'));

    await waitFor(() => {
      expect(runSignal?.aborted).toBe(true);
      expect(getStream().isLoading).toBe(false);
    });
    await act(async () => {
      await submission;
    });
  });

  it('finalizes and runs the single conversation created by the thread endpoint', async () => {
    sdkMocks.threadsCreate.mockResolvedValue({
      thread_id: 'thread-1',
      metadata: { id: 'conversation-1' },
    });
    sdkMocks.conversationsCreate.mockResolvedValue({
      id: 'conversation-1',
      threadId: 'thread-1',
    });
    renderStream();

    await act(async () => {
      await getStream().submit(
        { input: { input: 'Hello' } },
        optimisticFirstMessage(),
      );
    });

    expect(sdkMocks.conversationsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'conversation-1',
        threadId: 'thread-1',
        xpertId: 'xpert-1',
        projectId: 'project-1',
      }),
    );
    expect(sdkMocks.runsStream).toHaveBeenCalledWith(
      'thread-1',
      'xpert-1',
      expect.objectContaining({
        input: expect.objectContaining({ projectId: 'project-1' }),
      }),
    );
    expect(sdkMocks.threadsDelete).not.toHaveBeenCalled();
    expect(getStream().threadId).toBe('thread-1');
    expect(getStream().conversationId).toBe('conversation-1');
    expect(getStream().isLoading).toBe(false);
    expect(getStream().error).toBeNull();
  });

  it('recovers the persisted assistant message when the transport stream ends without final content', async () => {
    sdkMocks.threadsCreate.mockResolvedValue({
      thread_id: 'thread-1',
      metadata: { id: 'conversation-1' },
    });
    sdkMocks.conversationsCreate.mockResolvedValue({
      id: 'conversation-1',
      threadId: 'thread-1',
    });
    sdkMocks.conversationsSearchMessages.mockResolvedValue({
      items: [
        {
          id: 'assistant-1',
          role: 'ai',
          status: 'success',
          executionId: 'execution-1',
          content: [
            { type: 'text', text: 'Plan' },
            { type: 'text', text: 'All five steps completed' },
          ],
          createdAt: '2026-09-02T06:01:19.781Z',
          updatedAt: '2026-09-02T06:05:07.677Z',
        },
      ],
      total: 1,
    });
    renderStream();

    await act(async () => {
      await getStream().submit(
        { input: { input: 'Run the plan' } },
        optimisticFirstMessage(),
      );
    });

    expect(sdkMocks.conversationsSearchMessages).toHaveBeenCalledWith(
      'conversation-1',
      expect.objectContaining({
        where: { role: 'ai', threadId: 'thread-1' },
        limit: 1,
      }),
    );
    expect(getStream().messages).toContainEqual(
      expect.objectContaining({
        id: 'assistant-1',
        status: 'success',
        content: [
          { type: 'text', text: 'Plan' },
          { type: 'text', text: 'All five steps completed' },
        ],
      }),
    );
  });

  it('recovers the persisted assistant message when the transport stream disconnects with an error', async () => {
    sdkMocks.threadsCreate.mockResolvedValue({
      thread_id: 'thread-1',
      metadata: { id: 'conversation-1' },
    });
    sdkMocks.conversationsCreate.mockResolvedValue({
      id: 'conversation-1',
      threadId: 'thread-1',
    });
    sdkMocks.conversationsSearchMessages.mockResolvedValue({
      items: [
        {
          id: 'assistant-1',
          role: 'ai',
          status: 'success',
          content: [{ type: 'text', text: 'Recovered after disconnect' }],
          createdAt: '2026-09-02T06:01:19.781Z',
          updatedAt: '2026-09-02T06:05:07.677Z',
        },
      ],
      total: 1,
    });
    sdkMocks.runsStream.mockImplementation(async function* () {
      throw new Error('transport disconnected');
    });
    renderStream();

    await act(async () => {
      await getStream().submit(
        { input: { input: 'Run the plan' } },
        optimisticFirstMessage(),
      );
    });

    expect(getStream().messages).toContainEqual(
      expect.objectContaining({
        id: 'assistant-1',
        content: [{ type: 'text', text: 'Recovered after disconnect' }],
      }),
    );
    expect(getStream().error).toBeNull();
  });

  it('surfaces a thread creation failure and removes the optimistic message', async () => {
    let rejectThreadCreation: ((reason: unknown) => void) | undefined;
    sdkMocks.threadsCreate.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectThreadCreation = reject;
        }),
    );
    renderStream();

    let submission!: Promise<void>;
    act(() => {
      submission = getStream().submit(
        { input: { input: 'Hello' } },
        optimisticFirstMessage(),
      );
    });

    await waitFor(() => {
      expect(getStream().isLoading).toBe(true);
      expect(getStream().messages).toHaveLength(1);
    });

    const rejection = expect(submission).rejects.toThrow(
      'Thread creation failed',
    );
    await act(async () => {
      rejectThreadCreation?.('Thread creation failed');
      await rejection;
    });

    expect(getStream().isLoading).toBe(false);
    expect(getStream().messages).toEqual([]);
    expect(getStream().error).toEqual(new Error('Thread creation failed'));
    expect(sdkMocks.conversationsCreate).not.toHaveBeenCalled();
  });

  it('reuses the thread conversation id and rolls back when finalization fails', async () => {
    sdkMocks.threadsCreate.mockResolvedValue({
      thread_id: 'thread-1',
      metadata: { id: 'conversation-1' },
    });
    let rejectConversationCreation: ((reason: Error) => void) | undefined;
    let finishThreadRollback: (() => void) | undefined;
    sdkMocks.conversationsCreate.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectConversationCreation = reject;
        }),
    );
    sdkMocks.threadsDelete.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishThreadRollback = resolve;
        }),
    );
    renderStream();

    let submission!: Promise<void>;
    act(() => {
      submission = getStream().submit(
        { input: { input: 'Hello' } },
        optimisticFirstMessage(),
      );
    });

    await waitFor(() => {
      expect(sdkMocks.conversationsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'conversation-1',
          threadId: 'thread-1',
          xpertId: 'xpert-1',
          projectId: 'project-1',
        }),
      );
      expect(getStream().isLoading).toBe(true);
    });

    act(() => {
      rejectConversationCreation?.(
        new Error('Conversation finalization failed'),
      );
    });
    const rejection = expect(submission).rejects.toThrow(
      'Conversation finalization failed',
    );

    await waitFor(() => {
      expect(sdkMocks.threadsDelete).toHaveBeenCalledWith('thread-1');
      expect(getStream().threadId).toBeNull();
      expect(getStream().conversationId).toBeNull();
      expect(getStream().messages).toEqual([]);
      expect(getStream().isLoading).toBe(false);
      expect(getStream().error).toEqual(
        new Error('Conversation finalization failed'),
      );
    });

    await act(async () => {
      finishThreadRollback?.();
      await rejection;
    });
  });
});
