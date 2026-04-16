import { describe, expect, it, vi } from 'vitest';
import {
  CHAT_EVENT_TYPE_FOLLOW_UP_CONSUMED,
  ChatMessageEventTypeEnum,
  ChatMessageTypeEnum,
  type TThreadContextUsageEvent,
} from '@xpert-ai/chatkit-types';

import { normalizeClientSecretResult } from '../lib/client-secret';
import { createLangGraphEventState } from './langGraphEventMapper';
import {
  applyStreamEvent,
  buildSteerFollowUpRunInput,
  createFetchWithClientSecretRefresh,
  getAutoDrainQueuedFollowUpIds,
  getNextAutoQueuedFollowUp,
  getPendingSteerFollowUpIds,
  shouldBroadcastThreadChange,
} from './Stream';

describe('applyStreamEvent', () => {
  it('routes thread context usage chat events to realtime usage state without appending messages', () => {
    const setValues = vi.fn();
    const setError = vi.fn();
    const sendEvent = vi.fn();
    const onThreadContextUsage = vi.fn();
    const usageEvent: TThreadContextUsageEvent = {
      type: 'thread_context_usage',
      threadId: 'thread-1',
      agentKey: 'agent-1',
      runId: 'run-1',
      updatedAt: '2026-03-12T00:00:00.000Z',
      usage: {
        totalTokens: 180,
        contextTokens: 150,
        inputTokens: 120,
        outputTokens: 60,
      },
    };

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_CHAT_EVENT,
          data: usageEvent,
        }),
      },
      setValues,
      setError,
      sendEvent,
      [],
      createLangGraphEventState(),
      { threadId: 'thread-1' },
      undefined,
      onThreadContextUsage,
    );

    expect(onThreadContextUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'thread_context_usage',
        threadId: 'thread-1',
        agentKey: 'agent-1',
        usage: expect.objectContaining({
          totalTokens: 180,
        }),
      }),
    );
    expect(setValues).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
  });

  it('routes follow-up consumed chat events to the steer callback without appending messages', () => {
    const setValues = vi.fn();
    const setError = vi.fn();
    const sendEvent = vi.fn();
    const onFollowUpConsumed = vi.fn();

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_CHAT_EVENT,
          data: {
            type: CHAT_EVENT_TYPE_FOLLOW_UP_CONSUMED,
            mode: 'steer',
            messageIds: ['server-message-1'],
            clientMessageIds: ['client-message-1'],
            executionId: 'run-1',
            visibleAt: '2026-03-12T00:00:00.000Z',
          },
        }),
      },
      setValues,
      setError,
      sendEvent,
      [],
      createLangGraphEventState(),
      { threadId: 'thread-1' },
      undefined,
      undefined,
      onFollowUpConsumed,
    );

    expect(onFollowUpConsumed).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CHAT_EVENT_TYPE_FOLLOW_UP_CONSUMED,
        mode: 'steer',
        clientMessageIds: ['client-message-1'],
      }),
    );
    expect(setValues).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
  });

  it('does not treat tool end as steer consumption', () => {
    const onFollowUpConsumed = vi.fn();

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_TOOL_END,
          data: { id: 'tool-1' },
        }),
      },
      vi.fn(),
      vi.fn(),
      vi.fn(),
      [],
      createLangGraphEventState(),
      { threadId: 'thread-1' },
      undefined,
      undefined,
      onFollowUpConsumed,
    );

    expect(onFollowUpConsumed).not.toHaveBeenCalled();
  });

  it('appends streamed assistant text to the latest assistant message instead of a trailing steer user message', () => {
    let state = {
      messages: [
        {
          id: 'ai-1',
          type: 'ai',
          executionId: 'run-1',
          content: 'first chunk',
        },
        {
          id: 'user-steer-1',
          type: 'human',
          content: 'follow-up',
          followUpMode: 'steer' as const,
          followUpStatus: 'consumed' as const,
        },
      ],
    };
    const setValues = vi.fn((updater) => {
      state =
        typeof updater === 'function'
          ? updater(state)
          : updater;
    });

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.MESSAGE,
          data: ' second chunk',
        }),
      },
      setValues,
      vi.fn(),
      vi.fn(),
      [],
      createLangGraphEventState(),
      { threadId: 'thread-1' },
    );

    expect(state.messages[0]).toMatchObject({
      id: 'ai-1',
      content: 'first chunk second chunk',
    });
    expect(state.messages[1]).toMatchObject({
      id: 'user-steer-1',
      content: 'follow-up',
    });
  });

  it('starts a new assistant message after consumed steer before appending reply text', () => {
    let state = {
      messages: [
        {
          id: 'ai-1',
          type: 'ai',
          executionId: 'run-1',
          content: 'first answer',
        },
        {
          id: 'user-steer-1',
          type: 'human',
          content: 'follow-up',
          followUpMode: 'steer' as const,
          followUpStatus: 'consumed' as const,
        },
      ],
    };
    const setValues = vi.fn((updater) => {
      state =
        typeof updater === 'function'
          ? updater(state)
          : updater;
    });
    const consumeFreshAssistantSplit = vi
      .fn<() => boolean>()
      .mockReturnValueOnce(true)
      .mockReturnValue(false);

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.MESSAGE,
          data: 'new answer chunk',
        }),
      },
      setValues,
      vi.fn(),
      vi.fn(),
      [],
      createLangGraphEventState(),
      { threadId: 'thread-1' },
      undefined,
      undefined,
      undefined,
      consumeFreshAssistantSplit,
    );

    expect(consumeFreshAssistantSplit).toHaveBeenCalledTimes(1);
    expect(state.messages).toHaveLength(3);
    expect(state.messages[0]).toMatchObject({
      id: 'ai-1',
      content: 'first answer',
    });
    expect(state.messages[1]).toMatchObject({
      id: 'user-steer-1',
      content: 'follow-up',
    });
    expect(state.messages[2]).toMatchObject({
      type: 'ai',
      content: 'new answer chunk',
    });
  });
});

describe('buildSteerFollowUpRunInput', () => {
  it('builds an explicit follow_up request for xpert steer consumption', () => {
    const payload = buildSteerFollowUpRunInput({
      request: {
        id: 'client-message-1',
        input: {
          input: 'Please change direction',
          files: [{ id: 'file-1' }] as unknown as [],
        },
        state: {
          human: {
            input: 'Please change direction',
          },
        },
        executionId: 'run-1',
        followUpMode: 'steer',
      },
      conversationId: 'conversation-1',
      targetExecutionId: 'run-1',
      messages: [
        {
          id: 'ai-1',
          type: 'ai',
          executionId: 'run-1',
          content: 'ongoing answer',
        },
      ],
    });

    expect(payload).toEqual({
      action: 'follow_up',
      conversationId: 'conversation-1',
      mode: 'steer',
      message: {
        clientMessageId: 'client-message-1',
        input: {
          input: 'Please change direction',
          files: [{ id: 'file-1' }],
        },
      },
      target: {
        aiMessageId: 'ai-1',
        executionId: 'run-1',
      },
      state: {
        human: {
          input: 'Please change direction',
        },
      },
    });
  });

  it('returns null when steer follow-up is missing conversation id or text', () => {
    expect(
      buildSteerFollowUpRunInput({
        request: {
          id: 'client-message-1',
          input: {
            input: '   ',
          },
          followUpMode: 'steer',
        },
        conversationId: 'conversation-1',
      }),
    ).toBeNull();

    expect(
      buildSteerFollowUpRunInput({
        request: {
          id: 'client-message-1',
          input: {
            input: 'valid text',
          },
          followUpMode: 'steer',
        },
      }),
    ).toBeNull();
  });
});

describe('getNextAutoQueuedFollowUp', () => {
  it('returns only queue follow-ups that are marked for auto draining', () => {
    expect(
      getNextAutoQueuedFollowUp([
        {
          id: 'manual-queue',
          clientMessageId: 'manual-queue',
          mode: 'queue',
          request: {
            id: 'manual-queue',
            input: { input: 'manual queue' },
            followUpMode: 'queue',
          },
          createdAt: 1,
        },
        {
          id: 'steer',
          clientMessageId: 'steer',
          mode: 'steer',
          request: {
            id: 'steer',
            input: { input: 'steer' },
            followUpMode: 'steer',
          },
          createdAt: 2,
        },
        {
          id: 'auto-queue',
          clientMessageId: 'auto-queue',
          mode: 'queue',
          request: {
            id: 'auto-queue',
            input: { input: 'auto queue' },
            followUpMode: 'queue',
          },
          createdAt: 3,
        },
      ], ['auto-queue']),
    ).toMatchObject({
      id: 'auto-queue',
      mode: 'queue',
    });
  });
});

describe('getAutoDrainQueuedFollowUpIds', () => {
  it('returns queue follow-up ids so persisted pending items auto drain after load', () => {
    expect(
      getAutoDrainQueuedFollowUpIds([
        {
          id: 'queue-1',
          clientMessageId: 'queue-1',
          mode: 'queue',
          request: {
            id: 'queue-1',
            input: { input: 'queued' },
            followUpMode: 'queue',
          },
          createdAt: 1,
        },
        {
          id: 'steer-1',
          clientMessageId: 'steer-1',
          mode: 'steer',
          request: {
            id: 'steer-1',
            input: { input: 'steered' },
            followUpMode: 'steer',
          },
          createdAt: 2,
        },
      ]),
    ).toEqual(['queue-1']);
  });
});

describe('getPendingSteerFollowUpIds', () => {
  it('returns stale steer ids so the stream can auto-queue them when a run finishes', () => {
    expect(
      getPendingSteerFollowUpIds([
        {
          id: 'queue-1',
          clientMessageId: 'queue-1',
          mode: 'queue',
          request: {
            id: 'queue-1',
            input: { input: 'queued' },
            followUpMode: 'queue',
          },
          createdAt: 1,
        },
        {
          id: 'steer-1',
          clientMessageId: 'steer-1',
          mode: 'steer',
          request: {
            id: 'steer-1',
            input: { input: 'steered' },
            followUpMode: 'steer',
          },
          createdAt: 2,
        },
      ]),
    ).toEqual(['steer-1']);
  });
});

describe('shouldBroadcastThreadChange', () => {
  it('skips the initial empty thread notification during mount', () => {
    expect(
      shouldBroadcastThreadChange({
        threadId: null,
        hasObservedThreadSelection: false,
      }),
    ).toBe(false);
  });

  it('treats blank strings as an empty thread during the initial mount', () => {
    expect(
      shouldBroadcastThreadChange({
        threadId: '   ',
        hasObservedThreadSelection: false,
      }),
    ).toBe(false);
  });

  it('broadcasts the first real thread selection', () => {
    expect(
      shouldBroadcastThreadChange({
        threadId: 'thread-1',
        hasObservedThreadSelection: false,
      }),
    ).toBe(true);
  });

  it('still broadcasts a later reset back to no thread after a real thread existed', () => {
    expect(
      shouldBroadcastThreadChange({
        threadId: null,
        hasObservedThreadSelection: true,
      }),
    ).toBe(true);
  });
});

describe('createFetchWithClientSecretRefresh', () => {
  it('adds the organization header to the initial request', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    const request = createFetchWithClientSecretRefresh({
      fetchFn,
      getCurrentClientSecret: () => ({
        secret: 'cs-x-current',
        organizationId: 'org-1',
      }),
      refreshClientSecret: vi.fn(),
    });

    await request('https://example.com/test', {
      headers: {
        'x-trace-id': 'trace-1',
      },
    });

    const headers = new Headers(fetchFn.mock.calls[0]?.[1]?.headers);
    expect(headers.get('Authorization')).toBe('Bearer cs-x-current');
    expect(headers.get('x-api-key')).toBe('cs-x-current');
    expect(headers.get('organization-id')).toBe('org-1');
    expect(headers.get('x-trace-id')).toBe('trace-1');
  });

  it('retries a 401 with the refreshed secret and organization id', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const refreshClientSecret = vi.fn().mockResolvedValue({
      secret: 'cs-x-refreshed',
      organizationId: 'org-2',
    });
    const request = createFetchWithClientSecretRefresh({
      fetchFn,
      getCurrentClientSecret: () => ({
        secret: 'cs-x-current',
        organizationId: 'org-1',
      }),
      refreshClientSecret,
    });

    const response = await request('https://example.com/test');

    expect(response.status).toBe(200);
    expect(refreshClientSecret).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    const retryHeaders = new Headers(fetchFn.mock.calls[1]?.[1]?.headers);
    expect(retryHeaders.get('Authorization')).toBe('Bearer cs-x-refreshed');
    expect(retryHeaders.get('x-api-key')).toBe('cs-x-refreshed');
    expect(retryHeaders.get('organization-id')).toBe('org-2');
  });

  it('keeps the current organization id when refresh normalization uses the legacy string response', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const request = createFetchWithClientSecretRefresh({
      fetchFn,
      getCurrentClientSecret: () => ({
        secret: 'cs-x-current',
        organizationId: 'org-current',
      }),
      refreshClientSecret: async () =>
        normalizeClientSecretResult('cs-x-refreshed', 'org-current'),
    });

    await request('https://example.com/test');

    const retryHeaders = new Headers(fetchFn.mock.calls[1]?.[1]?.headers);
    expect(retryHeaders.get('Authorization')).toBe('Bearer cs-x-refreshed');
    expect(retryHeaders.get('organization-id')).toBe('org-current');
  });

  it('returns the original 401 response when refresh fails', async () => {
    const originalResponse = new Response(null, { status: 401 });
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(originalResponse);
    const request = createFetchWithClientSecretRefresh({
      fetchFn,
      getCurrentClientSecret: () => ({
        secret: 'cs-x-current',
        organizationId: 'org-1',
      }),
      refreshClientSecret: vi
        .fn()
        .mockRejectedValue(new Error('refresh failed')),
    });

    const response = await request('https://example.com/test');

    expect(response).toBe(originalResponse);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
