import { describe, expect, it, vi } from 'vitest';
import {
  CHAT_EVENT_TYPE_FOLLOW_UP_CONSUMED,
  ChatMessageEventTypeEnum,
  ChatMessageTypeEnum,
  REQUEST_USER_INPUT_RESULT_PURPOSE_IMPLEMENTATION_CONFIRMATION,
  REQUEST_USER_INPUT_RESULT_PURPOSE_PLAN_CLARIFICATION,
  REQUEST_USER_INPUT_RESULT_TYPE,
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
  getQueuedFollowUpGroup,
  getPendingSteerFollowUpIds,
  getRequestUserInputResultPurpose,
  mergeFollowUpHumanInputs,
  mergeQueuedFollowUpGroup,
  normalizeRequestUserInputParams,
  normalizeRequestUserInputToolCall,
  resolveClientToolCallResponse,
  shouldBroadcastThreadChange,
} from './Stream';

describe('request_user_input normalization', () => {
  const validParams = {
    questions: [
      {
        id: 'scope',
        header: 'Scope',
        question: 'Which scope should I use?',
        options: [
          {
            label: 'Minimal (Recommended)',
            description: 'Change only the requested surface.',
          },
          {
            label: 'Broad',
            description: 'Include adjacent cleanup.',
          },
        ],
      },
    ],
  };

  it('accepts Codex request_user_input params', () => {
    expect(normalizeRequestUserInputParams(validParams)).toEqual(validParams);
    expect(
      normalizeRequestUserInputToolCall({
        name: 'request_user_input',
        args: validParams,
        id: 'call-1',
      }),
    ).toEqual(validParams);
  });

  it('rejects missing or malformed questions', () => {
    expect(normalizeRequestUserInputParams({})).toBeNull();
    expect(normalizeRequestUserInputParams({ questions: [] })).toBeNull();
    expect(
      normalizeRequestUserInputParams({
        questions: [
          validParams.questions[0],
          validParams.questions[0],
          validParams.questions[0],
          validParams.questions[0],
        ],
      }),
    ).toBeNull();
  });

  it('rejects malformed option counts', () => {
    expect(
      normalizeRequestUserInputParams({
        questions: [
          {
            ...validParams.questions[0],
            options: [validParams.questions[0].options[0]],
          },
        ],
      }),
    ).toBeNull();
    expect(
      normalizeRequestUserInputParams({
        questions: [
          {
            ...validParams.questions[0],
            options: [
              ...validParams.questions[0].options,
              validParams.questions[0].options[0],
              validParams.questions[0].options[1],
            ],
          },
        ],
      }),
    ).toBeNull();
  });

  it('routes built-in request_user_input calls without the host handler', async () => {
    const sendCommand = vi.fn();
    const waitForRequestUserInput = vi.fn().mockResolvedValue({
      tool_call_id: 'call-1',
      name: 'request_user_input',
      status: 'success',
      content: {
        type: REQUEST_USER_INPUT_RESULT_TYPE,
        purpose: REQUEST_USER_INPUT_RESULT_PURPOSE_PLAN_CLARIFICATION,
        answers: [],
      },
    });

    const response = await resolveClientToolCallResponse(
      {
        name: 'request_user_input',
        args: validParams,
        id: 'call-1',
      },
      {
        isParentAvailable: true,
        sendCommand,
        waitForRequestUserInput,
      },
    );

    expect(response).toMatchObject({
      tool_call_id: 'call-1',
      name: 'request_user_input',
    });
    expect(waitForRequestUserInput).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'call-1' }),
      validParams,
    );
    expect(sendCommand).not.toHaveBeenCalled();
  });

  it('marks request_user_input results as clarification until the implementation confirmation question', () => {
    expect(getRequestUserInputResultPurpose(validParams)).toBe(
      REQUEST_USER_INPUT_RESULT_PURPOSE_PLAN_CLARIFICATION,
    );
    expect(
      getRequestUserInputResultPurpose({
        questions: [
          {
            id: 'implement_plan',
            header: 'Confirm',
            question: 'Implement this plan?',
            options: [
              {
                label: 'Yes, implement this plan',
                description: 'Proceed with the proposed implementation.',
              },
              {
                label: 'No, stop here',
                description: 'Do not implement anything.',
              },
            ],
          },
        ],
      }),
    ).toBe(REQUEST_USER_INPUT_RESULT_PURPOSE_IMPLEMENTATION_CONFIRMATION);
  });

  it('remembers request_user_input clientToolCalls from interrupt events for result components', () => {
    let state = {
      messages: [],
    } as any;
    const interrupts: unknown[] = [];
    const setValues = vi.fn((updater) => {
      state = typeof updater === 'function' ? updater(state) : updater;
    });

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_INTERRUPT,
          data: {
            tasks: [
              {
                id: '4c8cd80c-1203-5c0c-afa6-7fc72ebbe736',
                name: 'request_user_input',
                path: ['__pregel_push', 0],
                interrupts: [
                  {
                    id: '551c6ee1a636abc8f1e0fead6146eeec',
                    value: {
                      clientToolCalls: [
                        {
                          name: 'request_user_input',
                          args: validParams,
                          id: 'call_b3ca7548976b4bf4ac56b315',
                          type: 'tool_call',
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        }),
      },
      setValues,
      vi.fn(),
      vi.fn(),
      interrupts,
      createLangGraphEventState(),
      { threadId: 'thread-1' },
    );

    expect(interrupts).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({
      clientToolCalls: [
        {
          id: 'call_b3ca7548976b4bf4ac56b315',
          name: 'request_user_input',
        },
      ],
    });

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.MESSAGE,
          data: {
            id: 'call_b3ca7548976b4bf4ac56b315',
            type: 'component',
            data: {
              status: 'success',
              output: JSON.stringify({ answers: [] }),
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
    );

    expect(state.messages[0]).toMatchObject({
      clientToolCalls: [
        {
          id: 'call_b3ca7548976b4bf4ac56b315',
          name: 'request_user_input',
        },
      ],
    });
    expect(state.messages[0].content).toEqual([
      expect.objectContaining({
        id: 'call_b3ca7548976b4bf4ac56b315',
        type: 'component',
      }),
    ]);
  });

  it('does not treat ordinary interrupt toolCalls as client tool calls', () => {
    let state = {
      messages: [],
    } as any;
    const interrupts: unknown[] = [];
    const setValues = vi.fn((updater) => {
      state = typeof updater === 'function' ? updater(state) : updater;
    });

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_INTERRUPT,
          data: {
            tasks: [
              {
                id: 'task-1',
                name: 'request_user_input',
                path: ['__pregel_push', 0],
                interrupts: [
                  {
                    id: 'interrupt-1',
                    value: {
                      toolCalls: [
                        {
                          name: 'request_user_input',
                          args: validParams,
                          id: 'call-legacy',
                          type: 'tool_call',
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        }),
      },
      setValues,
      vi.fn(),
      vi.fn(),
      interrupts,
      createLangGraphEventState(),
      { threadId: 'thread-1' },
    );

    expect(interrupts).toHaveLength(1);
    expect(state.messages).toEqual([]);
  });

  it('keeps existing host client tool routing for other calls', async () => {
    const sendCommand = vi.fn().mockResolvedValue({
      tool_call_id: 'call-2',
      name: 'getUserStation',
      content: 'station',
      status: 'success',
    });
    const waitForRequestUserInput = vi.fn();

    const response = await resolveClientToolCallResponse(
      {
        name: 'getUserStation',
        args: { input: 'Query selected station' },
        id: 'call-2',
      },
      {
        isParentAvailable: true,
        sendCommand,
        waitForRequestUserInput,
      },
    );

    expect(response).toMatchObject({
      tool_call_id: 'call-2',
      name: 'getUserStation',
    });
    expect(sendCommand).toHaveBeenCalledWith('onClientToolCall', {
      name: 'getUserStation',
      params: { input: 'Query selected station' },
      id: 'call-2',
    });
    expect(waitForRequestUserInput).not.toHaveBeenCalled();
  });

  it('does not claim other client tool calls', () => {
    expect(
      normalizeRequestUserInputToolCall({
        name: 'getUserStation',
        args: validParams,
        id: 'call-2',
      }),
    ).toBeNull();
  });
});

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

  it('replays image references from server metadata without losing submitted input', () => {
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
              id: 'human-image-1',
              role: 'human',
              content: 'Pasted image',
              metadata: {
                referenceComposition: 'compose',
                references: [
                  {
                    type: 'image',
                    fileId: 'file-1',
                    url: 'https://example.com/image.png',
                    mimeType: 'image/png',
                    name: 'diagram.png',
                    width: 640,
                    height: 480,
                    size: 2048,
                    text: 'Pasted image: diagram.png',
                  },
                ],
              },
              input: {
                input: 'Referenced content:\n[Image] diagram.png',
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
        id: 'human-image-1',
        type: 'human',
        submittedInput: 'Referenced content:\n[Image] diagram.png',
        referenceComposition: 'compose',
        references: [
          expect.objectContaining({
            type: 'image',
            fileId: 'file-1',
            name: 'diagram.png',
            mimeType: 'image/png',
          }),
        ],
      }),
    ]);
    expect(setError).not.toHaveBeenCalled();
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
      state = typeof updater === 'function' ? updater(state) : updater;
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
      state = typeof updater === 'function' ? updater(state) : updater;
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
      getNextAutoQueuedFollowUp(
        [
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
        ],
        ['auto-queue'],
      ),
    ).toMatchObject({
      id: 'auto-queue',
      mode: 'queue',
    });
  });
});

describe('mergeFollowUpHumanInputs', () => {
  it('merges text, files, references, and later human fields in order', () => {
    expect(
      mergeFollowUpHumanInputs([
        {
          input: 'first',
          files: [{ id: 'file-1' }] as unknown as [],
          references: [{ type: 'quote', text: 'A' }] as unknown as [],
          referenceComposition: 'compose',
          custom: 'early',
        },
        {
          input: 'second',
          files: [{ id: 'file-2' }] as unknown as [],
          references: [{ type: 'quote', text: 'B' }] as unknown as [],
          custom: 'late',
        },
      ]),
    ).toEqual({
      input: 'first\n\nsecond',
      files: [{ id: 'file-1' }, { id: 'file-2' }],
      references: [
        { type: 'quote', text: 'A' },
        { type: 'quote', text: 'B' },
      ],
      referenceComposition: 'compose',
      custom: 'late',
    });
  });
});

describe('getQueuedFollowUpGroup', () => {
  it('returns queued follow-ups for the same target execution in created order', () => {
    const items = [
      {
        id: 'queue-2',
        clientMessageId: 'queue-2',
        mode: 'queue' as const,
        targetExecutionId: 'run-1',
        request: {
          id: 'queue-2',
          input: { input: 'second' },
          followUpMode: 'queue' as const,
        },
        createdAt: 2,
      },
      {
        id: 'queue-3',
        clientMessageId: 'queue-3',
        mode: 'queue' as const,
        targetExecutionId: 'run-2',
        request: {
          id: 'queue-3',
          input: { input: 'other run' },
          followUpMode: 'queue' as const,
        },
        createdAt: 3,
      },
      {
        id: 'queue-1',
        clientMessageId: 'queue-1',
        mode: 'queue' as const,
        targetExecutionId: 'run-1',
        request: {
          id: 'queue-1',
          input: { input: 'first' },
          followUpMode: 'queue' as const,
        },
        createdAt: 1,
      },
    ];

    expect(
      getQueuedFollowUpGroup(items, items[0]).map((item) => item.id),
    ).toEqual(['queue-1', 'queue-2']);
  });

  it('does not merge queued follow-ups without a target execution id', () => {
    const items = [
      {
        id: 'queue-1',
        clientMessageId: 'queue-1',
        mode: 'queue' as const,
        request: {
          id: 'queue-1',
          input: { input: 'first' },
          followUpMode: 'queue' as const,
        },
        createdAt: 1,
      },
      {
        id: 'queue-2',
        clientMessageId: 'queue-2',
        mode: 'queue' as const,
        request: {
          id: 'queue-2',
          input: { input: 'second' },
          followUpMode: 'queue' as const,
        },
        createdAt: 2,
      },
    ];

    expect(
      getQueuedFollowUpGroup(items, items[0]).map((item) => item.id),
    ).toEqual(['queue-1']);
  });
});

describe('mergeQueuedFollowUpGroup', () => {
  it('creates one merged queued send request while preserving grouped items', () => {
    const result = mergeQueuedFollowUpGroup(
      [
        {
          id: 'queue-1',
          clientMessageId: 'queue-1',
          mode: 'queue',
          targetExecutionId: 'run-1',
          request: {
            id: 'queue-1',
            input: {
              input: 'first',
              files: [{ id: 'file-1' }] as unknown as [],
            },
            state: {
              human: {
                input: 'first',
              },
            },
            followUpMode: 'queue',
          },
          context: {
            source: 'first',
          },
          createdAt: 1,
        },
        {
          id: 'queue-2',
          clientMessageId: 'queue-2',
          mode: 'queue',
          targetExecutionId: 'run-1',
          request: {
            id: 'queue-2',
            input: {
              input: 'second',
              references: [{ type: 'quote', text: 'ref' }] as unknown as [],
            },
            state: {
              human: {
                input: 'second',
              },
            },
            projectId: 'project-1',
            followUpMode: 'queue',
          },
          config: {
            checkpoint: 'latest',
          },
          createdAt: 2,
        },
      ],
      { leadItemId: 'queue-1' },
    );

    expect(result).toMatchObject({
      items: [
        expect.objectContaining({ id: 'queue-1' }),
        expect.objectContaining({ id: 'queue-2' }),
      ],
      request: {
        id: 'queue-1',
        input: {
          input: 'first\n\nsecond',
          files: [{ id: 'file-1' }],
          references: [{ type: 'quote', text: 'ref' }],
        },
        projectId: 'project-1',
        followUpMode: 'queue',
      },
      context: {
        source: 'first',
      },
      config: {
        checkpoint: 'latest',
      },
      targetExecutionId: 'run-1',
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
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 200 }));
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
