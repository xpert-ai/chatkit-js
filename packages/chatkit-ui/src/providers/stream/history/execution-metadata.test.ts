import {
  ChatMessageEventTypeEnum,
  ChatMessageTypeEnum,
} from '@xpert-ai/chatkit-types';
import { describe, expect, it, vi } from 'vitest';
import { createLangGraphEventState } from '../../langGraphEventMapper';
import {
  applyStreamEvent,
  normalizeConversationMessagesPage,
  type StateType,
} from '../../Stream';

describe('historical external assistant executions', () => {
  it('retains persisted timestamps and root duration through acknowledgements, completion and hydration', () => {
    let state: StateType = {
      messages: [{ id: 'client-h', type: 'human', content: 'Question' }],
    };
    const setValues: React.Dispatch<React.SetStateAction<StateType>> = (
      update,
    ) => {
      state = typeof update === 'function' ? update(state) : update;
    };
    const updatedAt = '2026-09-23T10:22:00Z';
    const agentRuns = [{ id: 'root', isRoot: true, elapsedTime: 479000 }];
    const emit = (event: ChatMessageEventTypeEnum, data: unknown) =>
      applyStreamEvent(
        {
          event: 'message',
          data: JSON.stringify({
            type: ChatMessageTypeEnum.EVENT,
            event,
            data,
          }),
        },
        setValues,
        vi.fn(),
        vi.fn(),
        [],
        createLangGraphEventState(),
      );
    emit(ChatMessageEventTypeEnum.ON_CONVERSATION_START, {
      id: 'conversation',
      userMessage: { id: 'h', clientMessageId: 'client-h', updatedAt },
    });
    expect(state.messages[0]).toMatchObject({ id: 'h', updatedAt });
    emit(ChatMessageEventTypeEnum.ON_MESSAGE_START, {
      id: 'a',
      role: 'ai',
      executionId: 'root',
      createdAt: updatedAt,
    });
    emit(ChatMessageEventTypeEnum.ON_MESSAGE_END, {
      id: 'a',
      role: 'ai',
      content: 'Answer',
      updatedAt,
      status: 'success',
      agentRuns,
    });
    expect(state.messages[1]).toMatchObject({
      updatedAt,
      status: 'success',
      agentRuns,
    });
    emit(ChatMessageEventTypeEnum.ON_CONVERSATION_END, {
      messages: [
        { id: 'h', role: 'human', content: 'Question' },
        { id: 'a', role: 'ai', content: 'Answer' },
      ],
    });
    expect(state.messages[0].updatedAt).toBe(updatedAt);
    expect(state.messages[1]).toMatchObject({
      updatedAt,
      status: 'success',
      agentRuns,
    });
    const page = normalizeConversationMessagesPage({
      items: [{ id: 'a', role: 'ai', content: 'Answer', updatedAt, agentRuns }],
    });
    expect(page.messages[0]).toMatchObject({ updatedAt, agentRuns });
  });
  it('carries the same branch capability through completion and history hydration', () => {
    let state: StateType = {
      messages: [{ id: 'a', type: 'ai', content: 'Answer' }],
    };
    const setValues: React.Dispatch<React.SetStateAction<StateType>> = (
      update,
    ) => {
      state = typeof update === 'function' ? update(state) : update;
    };
    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_MESSAGE_END,
          data: {
            id: 'a',
            role: 'ai',
            content: 'Answer',
            status: 'success',
            branching: { available: true },
          },
        }),
      },
      setValues,
      vi.fn(),
      vi.fn(),
      [],
      createLangGraphEventState(),
    );
    const page = normalizeConversationMessagesPage({
      items: [
        {
          id: 'a',
          role: 'ai',
          content: 'Answer',
          status: 'success',
          branching: { available: true },
          historical: true,
        },
      ],
    });
    expect(state.messages[0].branching).toEqual({ available: true });
    expect(page.messages[0].branching).toEqual(state.messages[0].branching);
    expect(page.messages[0].historical).toBe(true);
  });

  it('keeps live execution metadata when the final conversation snapshot omits it', () => {
    let state: import('../../Stream').StateType = {
      messages: [
        {
          id: 'a',
          type: 'ai',
          executionId: 'root',
          content: '',
          agentRuns: [
            {
              id: 'external',
              parentId: 'root',
              invocationKind: 'external_assistant',
              model: 'model-a',
              status: 'success',
            },
          ],
        },
      ],
    };
    const setValues: React.Dispatch<
      React.SetStateAction<import('../../Stream').StateType>
    > = (update) => {
      state = typeof update === 'function' ? update(state) : update;
    };
    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_CONVERSATION_END,
          data: {
            messages: [
              {
                id: 'a',
                type: 'ai',
                content: [
                  {
                    type: 'text',
                    text: 'Final output',
                    executionId: 'external',
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
      [],
      createLangGraphEventState(),
    );
    expect(state.messages[0].agentRuns?.[0]).toMatchObject({
      invocationKind: 'external_assistant',
      status: 'success',
      model: 'model-a',
    });
    expect(state.messages[0].executionId).toBe('root');
    expect(state.messages[0].content).toEqual([
      { type: 'text', text: 'Final output', executionId: 'external' },
    ]);
  });

  it('restores explicit execution identity, status and model alongside message content', () => {
    const message: import('@xpert-ai/xpert-sdk').ChatMessage = {
      id: 'message-1',
      role: 'ai',
      executionId: 'root',
      status: 'success',
      content: [
        { type: 'text', text: 'review result', executionId: 'external-1' },
      ],
      agentRuns: [
        {
          id: 'external-1',
          parentId: 'root',
          invocationKind: 'external_assistant',
          xpertId: 'reviewer',
          model: 'model-a',
          status: 'success',
        },
      ],
    };
    const page = normalizeConversationMessagesPage({ items: [message] });
    expect(page.messages[0].agentRuns).toEqual([
      expect.objectContaining({
        id: 'external-1',
        invocationKind: 'external_assistant',
        xpertId: 'reviewer',
        model: 'model-a',
        status: 'success',
      }),
    ]);
    expect(page.messages[0].content).toEqual(message.content);
  });
});
