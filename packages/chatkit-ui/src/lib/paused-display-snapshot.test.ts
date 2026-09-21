import { describe, expect, it } from 'vitest';
import {
  parsePausedDisplaySnapshot,
  reconcilePausedDisplaySteps,
  serializePausedDisplaySnapshot,
} from './paused-display-snapshot';

describe('paused display snapshot', () => {
  it('round trips visible text, tool results and root ancestry without execution state', () => {
    const values = parsePausedDisplaySnapshot(JSON.stringify({ version: 1, messages: [{
      id: 'reply', type: 'ai', content: [{ type: 'text', text: 'Partial', executionId: 'old-root' }, { type: 'tool_call', id: 'tool', output: 'done' }],
      executionId: 'new-root', rootExecutionIds: ['old-root', 'new-root'],
      reasoning: [{ type: 'reasoning', text: 'Thinking' }],
    }], checkpoint: 'not-display-data' }));
    expect(parsePausedDisplaySnapshot(serializePausedDisplaySnapshot(values))).toEqual(values);
    expect(values.messages[0].rootExecutionIds).toEqual(['old-root', 'new-root']);
    expect(serializePausedDisplaySnapshot(values)).not.toContain('checkpoint');
  });

  it.each(['{}', '{"version":2,"messages":[]}', '{"version":1,"messages":[{"type":"ai"}]}'])('rejects an invalid or unsupported snapshot: %s', (snapshot) => {
    expect(() => parsePausedDisplaySnapshot(snapshot)).toThrow();
  });

  it('drops transport completion markers instead of treating them as messages', () => {
    const values = parsePausedDisplaySnapshot(JSON.stringify({
      version: 1,
      messages: [
        { id: 'reply', type: 'ai', content: 'Partial' },
        { id: 'complete', type: 'complete', content: [{ type: 'complete' }] },
      ],
    }));

    expect(values.messages).toHaveLength(1);
    expect(values.messages[0].type).toBe('ai');
  });
});

describe('reconcilePausedDisplaySteps', () => {
  const step = (
    status: string,
    extra: Record<string, unknown> = {},
    id = 'shell-1',
  ) => ({
    id,
    type: 'component' as const,
    data: { category: 'Tool', tool: 'shell', status, ...extra },
  });
  const frozen = (...content: unknown[]) => ({
    messages: [
      { id: 'reply', type: 'ai' as const, content: content as never },
    ],
  });

  it('settles a step that finished while the view stayed frozen', () => {
    const before = frozen({ type: 'text', text: 'Partial' }, step('running'));
    const after = reconcilePausedDisplaySteps(
      before,
      frozen(
        { type: 'text', text: 'Partial and more' },
        step('success', { end_date: '2026-09-19T00:00:01Z' }),
        step('running', {}, 'shell-2'),
      ),
    );

    expect(after.messages[0].content).toEqual([
      { type: 'text', text: 'Partial' },
      step('success', { end_date: '2026-09-19T00:00:01Z' }),
    ]);
  });

  it('keeps the frozen view when nothing settled', () => {
    const before = frozen(step('running'));

    expect(reconcilePausedDisplaySteps(before, frozen(step('running')))).toBe(
      before,
    );
    expect(reconcilePausedDisplaySteps(before, { messages: [] })).toBe(before);
    expect(
      reconcilePausedDisplaySteps(before, {
        messages: [{ id: 'other', type: 'ai', content: [step('success')] as never }],
      }),
    ).toBe(before);
  });

  it('does not reopen a step the freeze already captured as settled', () => {
    const before = frozen(step('success'));

    expect(reconcilePausedDisplaySteps(before, frozen(step('running')))).toBe(
      before,
    );
  });
});
