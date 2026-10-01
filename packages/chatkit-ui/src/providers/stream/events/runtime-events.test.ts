import {
  CHAT_EVENT_TYPE_FOLLOW_UP_CONSUMED,
  ChatMessageEventTypeEnum,
  ChatMessageTypeEnum,
  type ThreadGoal,
  type TThreadContextUsageEvent,
} from '@xpert-ai/chatkit-types';
import { describe, expect, it, vi } from 'vitest';
import { createLangGraphEventState } from '../../langGraphEventMapper';
import { applyStreamEvent } from '../../Stream';

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

  it('drops incomplete thread context usage chat events without appending agent events', () => {
    const setValues = vi.fn();
    const setError = vi.fn();
    const sendEvent = vi.fn();
    const onThreadContextUsage = vi.fn();

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_CHAT_EVENT,
          data: {
            id: 'usage-event-1',
            type: 'thread_context_usage',
            title: 'Thread context usage',
            status: 'running',
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
      onThreadContextUsage,
    );

    expect(onThreadContextUsage).not.toHaveBeenCalled();
    expect(setValues).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
  });

  it('routes thread goal chat events to goal callbacks without appending messages', () => {
    const setValues = vi.fn();
    const setError = vi.fn();
    const sendEvent = vi.fn();
    const onThreadGoalUpdated = vi.fn();
    const onThreadGoalCleared = vi.fn();
    const onThreadGoalPatched = vi.fn();
    const goal: ThreadGoal = {
      id: 'goal-1',
      conversationId: 'conversation-1',
      threadId: 'thread-1',
      objective: 'ship feature',
      status: 'active',
      tokensUsed: 12,
      elapsedSeconds: 3,
      continuationCount: 1,
    };

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_CHAT_EVENT,
          data: {
            type: 'thread_goal_updated',
            conversationId: 'conversation-1',
            threadId: 'thread-1',
            goal,
            updatedAt: '2026-03-12T00:00:00.000Z',
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
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onThreadGoalUpdated,
      onThreadGoalCleared,
      onThreadGoalPatched,
    );

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_CHAT_EVENT,
          data: {
            type: 'thread_goal_cleared',
            conversationId: 'conversation-1',
            threadId: 'thread-1',
            updatedAt: '2026-03-12T00:00:01.000Z',
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
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onThreadGoalUpdated,
      onThreadGoalCleared,
      onThreadGoalPatched,
    );

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_CHAT_EVENT,
          data: {
            type: 'thread_goal_updated',
            goal: {
              id: 'goal-1',
              status: 'complete',
            },
            updatedAt: '2026-03-12T00:00:02.000Z',
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
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onThreadGoalUpdated,
      onThreadGoalCleared,
      onThreadGoalPatched,
    );

    expect(onThreadGoalUpdated).toHaveBeenCalledWith(goal);
    expect(onThreadGoalCleared).toHaveBeenCalledWith('thread-1');
    expect(onThreadGoalPatched).toHaveBeenCalledWith(
      expect.objectContaining({
        goalId: 'goal-1',
        goal: expect.objectContaining({ status: 'complete' }),
      }),
    );
    expect(setValues).not.toHaveBeenCalled();
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

  it('routes queue follow-up consumed chat events to the callback without appending messages', () => {
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
            mode: 'queue',
            messageIds: ['server-message-2'],
            clientMessageIds: ['client-message-2'],
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
        mode: 'queue',
        clientMessageIds: ['client-message-2'],
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

  it('routes write_todos message components to the todos callback', () => {
    const onTodosChange = vi.fn();
    const setValues = vi.fn();

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.MESSAGE,
          data: {
            id: 'tool-03f21fa4e7054e9eb484c560c15fb3f5',
            type: 'component',
            agentKey: 'Agent_xSd1VKEicG',
            data: {
              input: {
                todos: [
                  {
                    content: 'Render todos above the composer',
                    status: 'completed',
                  },
                  {
                    content: 'Update todos on later tool events',
                    status: 'in_progress',
                  },
                ],
              },
              category: 'Tool',
              toolset: 'todoListMiddleware',
              tool: 'write_todos',
              title: 'write_todos',
              created_date: '2026-04-24T12:24:52.898Z',
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
      { threadId: 'thread-1' },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onTodosChange,
    );

    expect(onTodosChange).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            id: 'todo-1',
            status: 'completed',
          }),
          expect.objectContaining({
            id: 'todo-2',
            status: 'in_progress',
          }),
        ],
      }),
    );
    expect(setValues).not.toHaveBeenCalled();
  });

  it('clears todos when write_todos message component returns an empty list', () => {
    const onTodosChange = vi.fn();
    const setValues = vi.fn();

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.MESSAGE,
          data: {
            id: 'tool-2',
            type: 'component',
            agentKey: 'Agent_xSd1VKEicG',
            data: {
              input: {
                todos: [],
              },
              category: 'Tool',
              toolset: 'todoListMiddleware',
              tool: 'write_todos',
              title: 'write_todos',
              created_date: '2026-04-24T12:24:52.898Z',
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
      { threadId: 'thread-1' },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onTodosChange,
    );

    expect(onTodosChange).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [],
      }),
    );
    expect(setValues).not.toHaveBeenCalled();
  });

  it('routes sandbox service tool components to runtime activity refresh without hiding the transcript message', () => {
    const onRuntimeActivityTrigger = vi.fn();
    const sendEvent = vi.fn();
    const setValues = vi.fn();

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.MESSAGE,
          data: {
            id: 'tool-service-1',
            type: 'component',
            agentKey: 'Agent_xSd1VKEicG',
            data: {
              input: {
                name: 'web',
              },
              category: 'Tool',
              toolset: 'sandbox',
              tool: 'sandbox_service_start',
              title: 'sandbox_service_start',
              created_date: '2026-05-02T12:24:52.898Z',
              status: 'running',
            },
          },
        }),
      },
      setValues,
      vi.fn(),
      sendEvent,
      [],
      createLangGraphEventState(),
      { threadId: 'thread-1' },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onRuntimeActivityTrigger,
    );

    expect(onRuntimeActivityTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 'sandbox-services',
        tool: 'sandbox_service_start',
        componentId: 'tool-service-1',
        threadId: 'thread-1',
      }),
    );
    expect(sendEvent).toHaveBeenCalledWith('public_event', [
      'log',
      expect.objectContaining({
        id: 'tool-service-1',
        name: 'component',
      }),
    ]);
    expect(setValues).toHaveBeenCalled();
  });

  it('does not trigger runtime activity refresh for other tool components', () => {
    const onRuntimeActivityTrigger = vi.fn();

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.MESSAGE,
          data: {
            id: 'tool-other-1',
            type: 'component',
            data: {
              category: 'Tool',
              tool: 'shell_exec',
              status: 'running',
            },
          },
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
      undefined,
      undefined,
      undefined,
      undefined,
      onRuntimeActivityTrigger,
    );

    expect(onRuntimeActivityTrigger).not.toHaveBeenCalled();
  });

  it('merges later write_todos component updates with the current todos snapshot', () => {
    const onTodosChange = vi.fn();
    const setValues = vi.fn();
    const currentTodos = {
      componentId: 'tool-03f21fa4e7054e9eb484c560c15fb3f5',
      title: 'write_todos',
      tool: 'write_todos' as const,
      category: 'Tool' as const,
      toolset: 'todoListMiddleware',
      status: 'running' as const,
      createdDate: '2026-04-24T12:24:52.898Z',
      items: [
        {
          id: 'todo-1',
          content: 'Render todos above the composer',
          status: 'completed' as const,
        },
      ],
      receivedAt: Date.now(),
    };

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.MESSAGE,
          data: {
            id: 'tool-03f21fa4e7054e9eb484c560c15fb3f5',
            type: 'component',
            data: {
              status: 'success',
              end_date: '2026-04-24T12:24:52.899Z',
              output: 'Updated todo list',
            },
          },
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
      undefined,
      () => currentTodos,
      onTodosChange,
    );

    expect(onTodosChange).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'tool-03f21fa4e7054e9eb484c560c15fb3f5',
        title: 'write_todos',
        tool: 'write_todos',
        status: 'success',
        endDate: '2026-04-24T12:24:52.899Z',
        output: 'Updated todo list',
      }),
    );
    expect(setValues).not.toHaveBeenCalled();
  });
});
