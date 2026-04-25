import { describe, expect, it } from 'vitest';

import {
  ASSISTANT_STREAM_IDLE_TO_THINKING_MS,
  appendMessageContent,
  getAssistantStreamingStatus,
  hasRenderableAssistantMessage,
  hasRenderableMessageContent,
  hasRenderableReasoning,
} from './message';

describe('message visibility helpers', () => {
  it('treats empty assistant placeholders as non-renderable', () => {
    expect(
      hasRenderableAssistantMessage({
        content: '',
        reasoning: undefined,
      } as any),
    ).toBe(false);

    expect(
      hasRenderableAssistantMessage({
        content: [],
        reasoning: [],
      } as any),
    ).toBe(false);
  });

  it('ignores empty text fragments inside content arrays', () => {
    expect(
      hasRenderableMessageContent([
        { type: 'text', text: '   ' },
      ] as any),
    ).toBe(false);
  });

  it('keeps assistant messages renderable when they contain components or reasoning', () => {
    expect(
      hasRenderableAssistantMessage({
        content: [{ type: 'component', data: { category: 'Tool' } }],
        reasoning: undefined,
      } as any),
    ).toBe(true);

    expect(
      hasRenderableReasoning([{ type: 'reasoning', text: 'thinking' }] as any),
    ).toBe(true);
  });

  it('maps streaming assistant states to loading, thinking, and answering', () => {
    expect(
      getAssistantStreamingStatus({ status: undefined, reasoning: undefined } as any, true),
    ).toBe('loading');

    expect(
      getAssistantStreamingStatus({ status: 'reasoning', reasoning: undefined } as any, true),
    ).toBe('thinking');

    expect(
      getAssistantStreamingStatus({ status: 'answering', reasoning: undefined } as any, true),
    ).toBe('answering');

    expect(
      getAssistantStreamingStatus({ status: 'answering', reasoning: undefined } as any, false),
    ).toBeNull();
  });

  it('treats idle loading or answering streams as thinking after the timeout', () => {
    const now = 10_000;
    const lastStreamOutputAt = now - ASSISTANT_STREAM_IDLE_TO_THINKING_MS - 1;

    expect(
      getAssistantStreamingStatus(
        {
          status: undefined,
          reasoning: undefined,
          lastStreamOutputAt,
        } as any,
        true,
        { now },
      ),
    ).toBe('thinking');

    expect(
      getAssistantStreamingStatus(
        {
          status: 'answering',
          reasoning: undefined,
          lastStreamOutputAt,
        } as any,
        true,
        { now },
      ),
    ).toBe('thinking');
  });

  it('keeps recent answering streams in answering status before the idle timeout', () => {
    const now = 10_000;
    const lastStreamOutputAt = now - ASSISTANT_STREAM_IDLE_TO_THINKING_MS + 1;

    expect(
      getAssistantStreamingStatus(
        {
          status: 'answering',
          reasoning: undefined,
          lastStreamOutputAt,
        } as any,
        true,
        { now },
      ),
    ).toBe('answering');
  });

  it('does not let previous reasoning override an active answering state', () => {
    const now = 10_000;
    const lastStreamOutputAt = now - 500;

    expect(
      getAssistantStreamingStatus(
        {
          status: 'answering',
          reasoning: [{ type: 'reasoning', text: 'thinking' }],
          lastStreamOutputAt,
        } as any,
        true,
        { now },
      ),
    ).toBe('answering');
  });
});

describe('appendMessageContent', () => {
  it('preserves tool metadata when a component update arrives with the same id', () => {
    const message = {
      id: 'assistant-1',
      type: 'assistant',
      content: [
        {
          id: 'tool-1',
          type: 'component',
          agentKey: 'Agent_xSd1VKEicG',
          data: {
            category: 'Tool',
            toolset: 'todoListMiddleware',
            tool: 'write_todos',
            title: 'write_todos',
            created_date: '2026-04-24T12:24:52.898Z',
            status: 'running',
            input: {
              todos: [
                {
                  content: 'Query ontology structure',
                  status: 'in_progress',
                },
              ],
            },
          },
        },
      ],
    } as any;

    appendMessageContent(message, {
      id: 'tool-1',
      type: 'component',
      data: {
        status: 'success',
        end_date: '2026-04-24T12:24:54.398Z',
        output: 'Updated todo list',
      },
    } as any);

    expect(message.content).toEqual([
      expect.objectContaining({
        id: 'tool-1',
        type: 'component',
        agentKey: 'Agent_xSd1VKEicG',
        data: expect.objectContaining({
          category: 'Tool',
          toolset: 'todoListMiddleware',
          tool: 'write_todos',
          title: 'write_todos',
          created_date: '2026-04-24T12:24:52.898Z',
          status: 'success',
          end_date: '2026-04-24T12:24:54.398Z',
          output: 'Updated todo list',
        }),
      }),
    ]);
  });
});
