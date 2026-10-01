import {
  ChatMessageEventTypeEnum,
  ChatMessageTypeEnum,
} from '@xpert-ai/chatkit-types';
import { describe, expect, it, vi } from 'vitest';
import { createLangGraphEventState } from '../../langGraphEventMapper';
import {
  applyStreamEvent,
  shouldIgnoreStreamError,
  type StateType,
} from '../../Stream';

describe('stream transport markers', () => {
  it('does not append the Redis completion marker as a chat message', () => {
    let state: StateType = { messages: [] };
    const setValues = vi.fn(
      (next: StateType | ((previous: StateType) => StateType)) => {
        state = typeof next === 'function' ? next(state) : next;
      },
    );

    applyStreamEvent(
      { event: 'values', data: JSON.stringify({ type: 'complete' }) },
      setValues,
      vi.fn(),
      vi.fn(),
      [],
      createLangGraphEventState(),
    );

    expect(state.messages).toEqual([]);
  });
});

describe('stream cancellation errors', () => {
  it('ignores decoder teardown errors after the user aborts the stream', () => {
    expect(
      shouldIgnoreStreamError(new SyntaxError('Unexpected token T'), {
        aborted: true,
      } as AbortSignal),
    ).toBe(true);
  });

  it('keeps the same decoder error when the stream was not aborted', () => {
    expect(
      shouldIgnoreStreamError(new SyntaxError('Unexpected token T'), {
        aborted: false,
      } as AbortSignal),
    ).toBe(false);
  });
});

describe('applyStreamEvent', () => {
  it('sets stream error from conversation end error events', () => {
    const setValues = vi.fn();
    const setError = vi.fn();
    const sendEvent = vi.fn();

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_CONVERSATION_END,
          data: {
            id: 'conversation-1',
            status: 'error',
            error: 'Invalid node name "sandbox_service_stop" in Send packet',
          },
        }),
      },
      setValues,
      setError,
      sendEvent,
      [],
      createLangGraphEventState(),
    );

    expect(setError).toHaveBeenCalledWith(expect.any(Error));
    expect((setError.mock.calls[0]?.[0] as Error).message).toBe(
      'Invalid node name "sandbox_service_stop" in Send packet',
    );
  });

  it('sets stream error from LangGraph error events', () => {
    const setValues = vi.fn();
    const setError = vi.fn();
    const sendEvent = vi.fn();

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_ERROR,
          data: {
            message: 'Run failed',
          },
        }),
      },
      setValues,
      setError,
      sendEvent,
      [],
      createLangGraphEventState(),
    );

    expect(setError).toHaveBeenCalledWith(expect.any(Error));
    expect((setError.mock.calls[0]?.[0] as Error).message).toBe('Run failed');
  });

  it('surfaces plain-text SSE error events without JSON parsing', () => {
    const setValues = vi.fn();
    const setError = vi.fn();
    const sendEvent = vi.fn();

    applyStreamEvent(
      {
        event: 'error',
        data: 'The request failed.',
      },
      setValues,
      setError,
      sendEvent,
      [],
      createLangGraphEventState(),
    );

    expect(setError).toHaveBeenCalledWith(expect.any(Error));
    expect((setError.mock.calls[0]?.[0] as Error).message).toBe(
      'The request failed.',
    );
  });
});
