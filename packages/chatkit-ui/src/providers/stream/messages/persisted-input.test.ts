import {
  ChatMessageEventTypeEnum,
  ChatMessageTypeEnum,
} from '@xpert-ai/chatkit-types';
import { describe, expect, it, vi } from 'vitest';
import { createLangGraphEventState } from '../../langGraphEventMapper';
import { applyStreamEvent } from '../../Stream';

describe('persisted input identity', () => {
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
