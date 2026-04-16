import { describe, expect, it, vi } from 'vitest';
import {
  ChatMessageEventTypeEnum,
  ChatMessageTypeEnum,
  type TThreadContextUsageEvent,
} from '@xpert-ai/chatkit-types';

import { normalizeClientSecretResult } from '../lib/client-secret';
import { createLangGraphEventState } from './langGraphEventMapper';
import { applyStreamEvent, createFetchWithClientSecretRefresh } from './Stream';

describe('applyStreamEvent', () => {
  it('normalizes replayed conversation messages with references and submitted input', () => {
    let state = { messages: [] as any[] };
    const setValues = vi.fn((next) => {
      state = typeof next === 'function' ? next(state) : next;
    });
    const setError = vi.fn();
    const sendEvent = vi.fn();

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_CONVERSATION_END,
          data: {
            messages: [
              {
                id: 'human-1',
                role: 'human',
                content: 'Referenced content',
                state: {
                  human: {
                    input: 'Explain this file',
                    referenceComposition: 'compose',
                    references: [
                      {
                        path: 'src/app.ts',
                        startLine: 4,
                        endLine: 8,
                        text: 'console.log("hello");',
                      },
                    ],
                  },
                },
              },
            ],
          },
        }),
      },
      setValues,
      setError,
      sendEvent,
      [],
      createLangGraphEventState(),
    );

    expect(state.messages).toEqual([
      expect.objectContaining({
        id: 'human-1',
        type: 'human',
        content: 'Referenced content',
        submittedInput: 'Explain this file',
        referenceComposition: 'compose',
        references: [
          expect.objectContaining({
            type: 'code',
            path: 'src/app.ts',
            startLine: 4,
            endLine: 8,
          }),
        ],
      }),
    ]);
    expect(setError).not.toHaveBeenCalled();
  });

  it('keeps message metadata when replaying top-level messages arrays', () => {
    let state = { messages: [] as any[] };
    const setValues = vi.fn((next) => {
      state = typeof next === 'function' ? next(state) : next;
    });
    const setError = vi.fn();
    const sendEvent = vi.fn();

    applyStreamEvent(
      {
        event: 'values',
        data: JSON.stringify({
          messages: [
            {
              id: 'human-2',
              role: 'human',
              content: 'Quoted content',
              metadata: {
                referenceComposition: 'compose',
                references: [
                  {
                    type: 'quote',
                    source: 'Assistant response',
                    text: 'Look at the prior answer.',
                  },
                ],
              },
              input: {
                input: 'Respond to the quoted content',
              },
            },
          ],
        }),
      },
      setValues,
      setError,
      sendEvent,
      [],
      createLangGraphEventState(),
    );

    expect(state.messages).toEqual([
      expect.objectContaining({
        id: 'human-2',
        type: 'human',
        submittedInput: 'Respond to the quoted content',
        referenceComposition: 'compose',
        references: [
          expect.objectContaining({
            type: 'quote',
            source: 'Assistant response',
          }),
        ],
      }),
    ]);
  });

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
