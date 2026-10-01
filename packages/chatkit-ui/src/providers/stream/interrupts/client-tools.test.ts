import {
  ChatMessageEventTypeEnum,
  ChatMessageTypeEnum,
  REQUEST_USER_INPUT_RESULT_PURPOSE_IMPLEMENTATION_CONFIRMATION,
  REQUEST_USER_INPUT_RESULT_PURPOSE_PLAN_CLARIFICATION,
  REQUEST_USER_INPUT_RESULT_TYPE,
} from '@xpert-ai/chatkit-types';
import { describe, expect, it, vi } from 'vitest';
import { createLangGraphEventState } from '../../langGraphEventMapper';
import {
  applyStreamEvent,
  getRequestUserInputResultPurpose,
  normalizeRequestUserInputParams,
  normalizeRequestUserInputToolCall,
  normalizeToolMessagesResponse,
  resolveClientToolCallResponse,
} from '../../Stream';

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

  it('preserves client tool artifacts when normalizing resume messages', () => {
    const screenshotArtifact = {
      type: 'host_page_screenshot',
      mimeType: 'image/png',
      data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
      viewport: { width: 1440, height: 900 },
      imageSize: { width: 1, height: 1 },
      coordinateSpace: 'viewport-css-px',
    };

    expect(
      normalizeToolMessagesResponse({
        tool_call_id: 'call-3',
        name: 'host_page_screenshot',
        content: JSON.stringify({
          ok: true,
          result: {
            mimeType: 'image/png',
            dataLength: screenshotArtifact.data.length,
          },
        }),
        status: 'success',
        artifact: screenshotArtifact,
      }),
    ).toEqual({
      tool_call_id: 'call-3',
      name: 'host_page_screenshot',
      content: JSON.stringify({
        ok: true,
        result: {
          mimeType: 'image/png',
          dataLength: screenshotArtifact.data.length,
        },
      }),
      status: 'success',
      artifact: screenshotArtifact,
    });
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
