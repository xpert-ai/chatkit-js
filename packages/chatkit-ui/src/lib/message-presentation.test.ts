import { describe, expect, it } from 'vitest';
import type { ChatkitMessage } from '@xpert-ai/chatkit-types';
import {
  buildMessagePresentation,
  getMessageBubbleText,
  resolveMessagePresentation,
} from './message-presentation';

describe('message presentation policy', () => {
  it('preserves defaults and resolves explicit values before assistant defaults', () => {
    expect(resolveMessagePresentation()).toEqual({
      mode: 'transcript',
      collapseProcess: false,
    });
    expect(resolveMessagePresentation({ collapseProcess: true })).toEqual({
      mode: 'transcript',
      collapseProcess: true,
    });
    expect(
      resolveMessagePresentation({ mode: 'bubbles', collapseProcess: true }),
    ).toEqual({ mode: 'bubbles', collapseProcess: false });
    expect(
      resolveMessagePresentation(
        { mode: 'transcript', collapseProcess: false },
        { mode: 'bubbles', collapseProcess: true },
      ),
    ).toEqual({ mode: 'transcript', collapseProcess: false });
    expect(
      resolveMessagePresentation({ collapseProcess: true }, { mode: 'bubbles' })
        .mode,
    ).toBe('bubbles');
  });

  it('keeps source positions, actors and text boundaries without mutating messages', () => {
    const message: ChatkitMessage = {
      id: 'm',
      type: 'assistant',
      content: [
        { id: 'a', type: 'text', text: 'First\n\nparagraph' },
        {
          id: 'tool',
          type: 'component',
          data: { category: 'Tool', type: 'tool', output: 'private process' },
        },
        { id: 'b', type: 'text', text: 'Second' },
        { type: 'component', data: { type: 'Widget', widgets: [] } },
      ],
    };
    const before = structuredClone(message);
    const actor = { id: 'assistant:a', kind: 'assistant' as const };
    const blocks = buildMessagePresentation(message, actor);
    expect(blocks.map((block) => block.kind)).toEqual([
      'text',
      'process',
      'text',
      'rich',
    ]);
    expect(blocks[2].source.sourceIndex).toBe(2);
    expect(blocks[2].key).toBe('m:content:b');
    expect(blocks[2].actor).toBe(actor);
    expect(getMessageBubbleText(message)).toBe('First\n\nparagraph\n\nSecond');
    expect(message).toEqual(before);
    const other = buildMessagePresentation(message, {
      id: 'assistant:b',
      kind: 'assistant',
    });
    expect(other[0].actor?.id).not.toBe(blocks[0].actor?.id);
  });
});
