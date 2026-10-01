import {
  ChatMessageEventTypeEnum,
  ChatMessageTypeEnum,
} from '@xpert-ai/chatkit-types';
import { describe, expect, it, vi } from 'vitest';
import { createLangGraphEventState } from '../../langGraphEventMapper';
import { applyStreamEvent } from '../../Stream';

describe('applyStreamEvent', () => {
  it('upserts agent run lifecycle events onto the latest assistant message', () => {
    let state = {
      messages: [
        {
          id: 'ai-1',
          type: 'ai',
          executionId: 'root-exec',
          content: '',
        },
      ],
    } as any;
    const setValues = vi.fn((updater) => {
      state = typeof updater === 'function' ? updater(state) : updater;
    });

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_AGENT_START,
          data: {
            id: 'child-exec',
            parentId: 'root-exec',
            agentKey: 'Agent_A',
            title: 'Researcher',
            inputs: { topic: 'pricing' },
          },
        }),
      },
      setValues,
      vi.fn(),
      vi.fn(),
      [],
      createLangGraphEventState(),
    );

    expect(state.messages[0].agentRuns).toEqual([
      expect.objectContaining({
        id: 'child-exec',
        parentId: 'root-exec',
        agentKey: 'Agent_A',
        title: 'Researcher',
        status: 'running',
      }),
    ]);

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_AGENT_END,
          data: {
            id: 'child-exec',
            parentId: 'root-exec',
            agentKey: 'Agent_A',
            title: 'Researcher',
            status: 'success',
            elapsedTime: '1234',
          },
        }),
      },
      setValues,
      vi.fn(),
      vi.fn(),
      [],
      createLangGraphEventState(),
    );

    expect(state.messages[0].agentRuns).toEqual([
      expect.objectContaining({
        id: 'child-exec',
        status: 'success',
        elapsedTime: 1234,
        inputs: { topic: 'pricing' },
      }),
    ]);
  });

  it('ignores legacy middleware lifecycle events as agent runs', () => {
    let state = {
      messages: [
        {
          id: 'ai-1',
          type: 'ai',
          executionId: 'root-exec',
          content: '',
        },
      ],
    } as any;
    const setValues = vi.fn((updater) => {
      state = typeof updater === 'function' ? updater(state) : updater;
    });

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_AGENT_START,
          data: {
            id: 'middleware-exec',
            parentId: 'root-exec',
            type: 'middleware',
            category: 'workflow',
            agentKey: 'model-retry-node',
            title: 'Model Retry Middleware',
          },
        }),
      },
      setValues,
      vi.fn(),
      vi.fn(),
      [],
      createLangGraphEventState(),
    );

    expect(state.messages[0].agentRuns).toBeUndefined();
  });

  it('appends middleware chat events as ordinary event content', () => {
    let state = {
      messages: [
        {
          id: 'ai-1',
          type: 'ai',
          executionId: 'root-exec',
          content: [],
        },
      ],
    } as any;
    const setValues = vi.fn((updater) => {
      state = typeof updater === 'function' ? updater(state) : updater;
    });

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_CHAT_EVENT,
          data: {
            type: 'middleware_event',
            middlewareName: 'ModelRetryMiddleware',
            middlewareKey: 'model-retry-node',
            title: 'Model retry',
            message: 'Retrying model call, attempt 2/3',
            status: 'running',
            phase: 'retry_started',
            executionId: 'root-exec',
            threadId: 'thread-1',
          },
        }),
      },
      setValues,
      vi.fn(),
      vi.fn(),
      [],
      createLangGraphEventState(),
    );

    expect(state.messages[0].agentRuns).toBeUndefined();
    expect(state.messages[0].content).toEqual([
      expect.objectContaining({
        id: 'middleware:root-exec:model-retry-node:retry:default',
        type: 'agent_event',
        event: 'middleware_event',
        title: 'Model retry',
        message: 'Retrying model call, attempt 2/3',
        executionId: 'root-exec',
      }),
    ]);
  });

  it('updates middleware chat events in place for the same attempt', () => {
    let state = {
      messages: [
        {
          id: 'ai-1',
          type: 'ai',
          executionId: 'root-exec',
          content: [],
        },
      ],
    } as any;
    const setValues = vi.fn((updater) => {
      state = typeof updater === 'function' ? updater(state) : updater;
    });
    const pushMiddlewareEvent = (data: Record<string, unknown>) =>
      applyStreamEvent(
        {
          event: 'message',
          data: JSON.stringify({
            type: ChatMessageTypeEnum.EVENT,
            event: ChatMessageEventTypeEnum.ON_CHAT_EVENT,
            data: {
              type: 'middleware_event',
              middlewareName: 'ModelFallbackMiddleware',
              middlewareKey: 'model-fallback-node',
              title: 'Model fallback',
              executionId: 'root-exec',
              threadId: 'thread-1',
              data: { attempt: 1, totalAttempts: 1, model: 'glm-5.1' },
              ...data,
            },
          }),
        },
        setValues,
        vi.fn(),
        vi.fn(),
        [],
        createLangGraphEventState(),
      );

    pushMiddlewareEvent({
      phase: 'fallback_started',
      message: 'Trying fallback model 1/1',
      status: 'running',
    });
    pushMiddlewareEvent({
      phase: 'fallback_succeeded',
      message: 'Fallback model succeeded 1/1',
      status: 'success',
    });

    expect(state.messages[0].content).toEqual([
      expect.objectContaining({
        id: 'middleware:root-exec:model-fallback-node:fallback:1',
        type: 'agent_event',
        event: 'middleware_event',
        title: 'Model fallback',
        message: 'Fallback model succeeded 1/1',
        status: 'success',
      }),
    ]);
  });

  it('keeps agent run state when message start replaces an empty placeholder', () => {
    let state = { messages: [] } as any;
    const setValues = vi.fn((updater) => {
      state = typeof updater === 'function' ? updater(state) : updater;
    });

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_AGENT_START,
          data: {
            id: 'child-exec',
            parentId: 'root-exec',
            title: 'Researcher',
          },
        }),
      },
      setValues,
      vi.fn(),
      vi.fn(),
      [],
      createLangGraphEventState(),
    );

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_MESSAGE_START,
          data: {
            id: 'ai-1',
            type: 'ai',
            executionId: 'root-exec',
            content: '',
          },
        }),
      },
      setValues,
      vi.fn(),
      vi.fn(),
      [],
      createLangGraphEventState(),
    );

    expect(state.messages[0]).toMatchObject({
      id: 'ai-1',
      executionId: 'root-exec',
      agentRuns: [
        expect.objectContaining({
          id: 'child-exec',
          status: 'running',
        }),
      ],
    });
  });

  it('appends the new response after newer messages instead of reusing a stale empty placeholder from a failed run', () => {
    let state = {
      messages: [
        { id: 'human-a', type: 'human', content: 'first question' },
        { id: 'ai-stale', type: 'ai', executionId: 'failed-exec', content: '' },
        { id: 'human-b', type: 'human', content: 'second question' },
      ],
    } as any;
    const setValues = vi.fn((updater) => {
      state = typeof updater === 'function' ? updater(state) : updater;
    });

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_MESSAGE_START,
          data: {
            id: 'ai-new',
            type: 'ai',
            executionId: 'new-exec',
            content: '',
          },
        }),
      },
      setValues,
      vi.fn(),
      vi.fn(),
      [],
      createLangGraphEventState(),
    );

    expect(state.messages.map((message: { id: string }) => message.id)).toEqual(
      ['human-a', 'ai-stale', 'human-b', 'ai-new'],
    );
    expect(state.messages[3]).toMatchObject({
      id: 'ai-new',
      executionId: 'new-exec',
    });
  });

  it('preserves execution metadata on streamed text and merged components', () => {
    let state = {
      messages: [
        {
          id: 'ai-1',
          type: 'ai',
          executionId: 'root-exec',
          content: [],
        },
      ],
    } as any;
    const setValues = vi.fn((updater) => {
      state = typeof updater === 'function' ? updater(state) : updater;
    });

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.MESSAGE,
          data: {
            id: 'text-1',
            type: 'text',
            text: 'child text',
            executionId: 'child-exec',
            parentExecutionId: 'root-exec',
            agentKey: 'Agent_A',
          },
        }),
      },
      setValues,
      vi.fn(),
      vi.fn(),
      [],
      createLangGraphEventState(),
    );

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.MESSAGE,
          data: {
            id: 'tool-1',
            type: 'component',
            executionId: 'child-exec',
            parentExecutionId: 'root-exec',
            agentKey: 'Agent_A',
            data: {
              category: 'Tool',
              tool: 'read_file',
              status: 'running',
            },
          },
        }),
      },
      setValues,
      vi.fn(),
      vi.fn(),
      [],
      createLangGraphEventState(),
    );

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.MESSAGE,
          data: {
            id: 'tool-1',
            type: 'component',
            data: {
              status: 'success',
              output: 'done',
            },
          },
        }),
      },
      setValues,
      vi.fn(),
      vi.fn(),
      [],
      createLangGraphEventState(),
    );

    expect(state.messages[0].content).toEqual([
      expect.objectContaining({
        id: 'text-1',
        executionId: 'child-exec',
        parentExecutionId: 'root-exec',
      }),
      expect.objectContaining({
        id: 'tool-1',
        executionId: 'child-exec',
        parentExecutionId: 'root-exec',
        data: expect.objectContaining({
          status: 'success',
          output: 'done',
        }),
      }),
    ]);
  });

  it('appends execution-scoped chat events as compact agent event content', () => {
    let state = {
      messages: [
        {
          id: 'ai-1',
          type: 'ai',
          executionId: 'root-exec',
          content: [],
        },
      ],
    } as any;
    const setValues = vi.fn((updater) => {
      state = typeof updater === 'function' ? updater(state) : updater;
    });

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_CHAT_EVENT,
          data: {
            type: 'progress',
            title: 'Fetched source list',
            message: '3 sources',
            executionId: 'child-exec',
            parentExecutionId: 'root-exec',
            agentKey: 'Agent_A',
          },
        }),
      },
      setValues,
      vi.fn(),
      vi.fn(),
      [],
      createLangGraphEventState(),
      { threadId: 'thread-1' },
    );

    expect(state.messages[0].content).toEqual([
      expect.objectContaining({
        type: 'agent_event',
        event: 'progress',
        title: 'Fetched source list',
        message: '3 sources',
        executionId: 'child-exec',
        parentExecutionId: 'root-exec',
        agentKey: 'Agent_A',
      }),
    ]);
  });
});
