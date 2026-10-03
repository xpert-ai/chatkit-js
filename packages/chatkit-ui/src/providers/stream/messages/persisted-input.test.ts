import {
  ChatMessageEventTypeEnum,
  ChatMessageTypeEnum,
} from '@xpert-ai/chatkit-types';
import { describe, expect, it, vi } from 'vitest';
import { createLangGraphEventState } from '../../langGraphEventMapper';
import { applyStreamEvent } from '../../Stream';
import type { StateType } from '../types';

describe('persisted input identity', () => {
  it.each(['Draft generated', ''])(
    'keeps separate messages in the same execution, including an empty draft (%s)',
    (draft) => {
      let state: StateType = { messages: [] };
      const setValues = (
        next: StateType | ((previous: StateType) => StateType),
      ) => {
        state = typeof next === 'function' ? next(state) : next;
      };
      const events = createLangGraphEventState();
      const emit = (
        event: ChatMessageEventTypeEnum,
        id: string,
        content: string,
      ) =>
        applyStreamEvent(
          {
            event: 'message',
            data: JSON.stringify({
              type: ChatMessageTypeEnum.EVENT,
              event,
              data: { id, role: 'ai', executionId: 'evolution-run', content },
            }),
          },
          setValues,
          vi.fn(),
          vi.fn(),
          [],
          events,
        );

      emit(ChatMessageEventTypeEnum.ON_MESSAGE_START, 'draft', draft);
      emit(ChatMessageEventTypeEnum.ON_MESSAGE_END, 'draft', draft);
      emit(ChatMessageEventTypeEnum.ON_MESSAGE_START, 'checks', 'Checking');
      emit(ChatMessageEventTypeEnum.ON_MESSAGE_END, 'checks', 'Checks passed');
      expect(
        state.messages.map(({ id, content }) => ({ id, content })),
      ).toEqual([
        { id: 'draft', content: draft },
        { id: 'checks', content: 'Checks passed' },
      ]);

      // A resumed Redis stream can replay an earlier phase after history is loaded.
      emit(ChatMessageEventTypeEnum.ON_MESSAGE_START, 'draft', draft);
      applyStreamEvent(
        {
          event: 'message',
          data: JSON.stringify({
            type: ChatMessageTypeEnum.MESSAGE,
            data: 'Replayed draft text',
          }),
        },
        setValues,
        vi.fn(),
        vi.fn(),
        [],
        events,
      );
      expect(
        state.messages.find((message) => message.id === 'checks')?.content,
      ).toBe('Checks passed');
      emit(ChatMessageEventTypeEnum.ON_MESSAGE_END, 'draft', draft);
      expect(
        state.messages.map(({ id, content }) => ({ id, content })),
      ).toEqual([
        { id: 'draft', content: draft },
        { id: 'checks', content: 'Checks passed' },
      ]);
    },
  );

  it('retains execution matching when legacy message-start events omit the message id', () => {
    let state: StateType = {
      messages: [
        { id: 'reply', type: 'ai', content: 'Partial', executionId: 'run' },
      ],
    };
    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_MESSAGE_START,
          data: { role: 'ai', executionId: 'run' },
        }),
      },
      (next) => {
        state = typeof next === 'function' ? next(state) : next;
      },
      vi.fn(),
      vi.fn(),
      [],
      createLangGraphEventState(),
    );
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({
      id: 'reply',
      content: 'Partial',
    });
  });

  it('continues the same assistant message when a paused run gets a new execution id', () => {
    const state = {
      messages: [
        {
          id: 'assistant',
          type: 'ai',
          content: 'Saved partial reply',
          executionId: 'old-run',
        },
      ],
    };
    const setValues = vi.fn();
    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_MESSAGE_START,
          data: {
            id: 'assistant',
            role: 'ai',
            executionId: 'new-run',
            content: 'Saved partial reply',
          },
        }),
      },
      setValues,
      vi.fn(),
      vi.fn(),
      [],
      createLangGraphEventState(),
    );
    expect(setValues.mock.calls[0][0](state).messages).toEqual([
      { ...state.messages[0], executionId: 'new-run', type: 'ai' },
    ]);
  });
  it('matches only the acknowledged optimistic input, preserving its attachments and other messages', () => {
    const state = {
      messages: [
        {
          id: 'optimistic',
          type: 'human' as const,
          content: 'edited input',
          fileAssets: [{ id: 'file' }],
        },
        { id: 'queued', type: 'human' as const, content: 'later input' },
      ],
    };
    const setValues = vi.fn();
    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_CONVERSATION_START,
          data: {
            id: 'conversation',
            userMessage: {
              id: 'persisted',
              role: 'human',
              content: 'edited input',
              clientMessageId: 'optimistic',
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
    const next = setValues.mock.calls[0][0](state);
    expect(next.messages[0]).toEqual({ ...state.messages[0], id: 'persisted' });
    expect(next.messages[1]).toEqual(state.messages[1]);
  });
});
