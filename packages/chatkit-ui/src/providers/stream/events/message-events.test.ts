import {
  ChatMessageEventTypeEnum,
  ChatMessageTypeEnum,
} from '@xpert-ai/chatkit-types';
import { describe, expect, it, vi } from 'vitest';
import { createLangGraphEventState } from '../../langGraphEventMapper';
import { applyStreamEvent } from '../../Stream';

describe('conversation lifecycle stream events', () => {
  it('resolves the current conversation id when a new conversation starts', () => {
    const onConversationStart = vi.fn();

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_CONVERSATION_START,
          data: { id: 'conversation-new', status: 'busy' },
        }),
      },
      vi.fn(),
      vi.fn(),
      vi.fn(),
      [],
      createLangGraphEventState(),
      { threadId: 'thread-new' },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onConversationStart,
    );

    expect(onConversationStart).toHaveBeenCalledWith('conversation-new');
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

  it('preserves local optimistic messages when replaying server message lists', () => {
    const optimisticMessage = {
      id: 'goal-human-1',
      type: 'human',
      content: 'find the top AI repos',
      submittedInput: 'find the top AI repos',
    };
    let state = {
      messages: [
        {
          id: 'history-1',
          type: 'ai',
          content: 'Previous answer',
        },
        optimisticMessage,
      ],
    } as any;
    const setValues = vi.fn((next) => {
      state = typeof next === 'function' ? next(state) : next;
    });

    applyStreamEvent(
      {
        event: 'message',
        data: JSON.stringify({
          type: ChatMessageTypeEnum.EVENT,
          event: ChatMessageEventTypeEnum.ON_CONVERSATION_END,
          data: {
            messages: [
              {
                id: 'history-1',
                role: 'assistant',
                content: 'Previous answer',
              },
              {
                id: 'assistant-2',
                role: 'assistant',
                content: 'Here are the top AI repos.',
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
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      [optimisticMessage],
    );

    expect(state.messages).toEqual([
      expect.objectContaining({ id: 'history-1' }),
      expect.objectContaining({
        id: 'goal-human-1',
        type: 'human',
        content: 'find the top AI repos',
      }),
      expect.objectContaining({ id: 'assistant-2' }),
    ]);
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
