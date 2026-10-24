import { describe, expect, it } from 'vitest';
import { createLangGraphEventState } from '../../langGraphEventMapper';
import {
  compareDisplayCursors,
  hydrateDisplaySnapshot,
  parseDisplaySnapshot,
  restoreDisplayEventState,
} from './display-snapshot';

function payload() {
  return {
    type: 'stream_snapshot',
    continuous: true,
    snapshot: {
      version: 1,
      threadId: 'thread',
      runId: 'run',
      segmentId: 'segment',
      revision: 2,
      cursor: '20-0',
      activeMessageId: 'second',
      messages: [
        {
          id: 'first',
          role: 'ai',
          executionId: 'run',
          content: 'finished',
          agentRuns: [{ id: 'agent', status: 'success' }],
        },
        {
          id: 'second',
          role: 'ai',
          executionId: 'run',
          content: 'prefix',
          reasoning: [
            { type: 'reasoning', text: 'analysis', executionId: 'child' },
          ],
          clientToolCalls: [{ name: 'unsafe' }],
          inputCheckpoint: { unsafe: true },
        },
      ],
    },
  };
}

describe('display hydration boundary', () => {
  it('replaces only the affected messages and restores the current message identity without dispatching events', () => {
    const snapshot = parseDisplaySnapshot(payload())!;
    expect(snapshot).not.toBeNull();
    const result = hydrateDisplaySnapshot(
      {
        messages: [
          { id: 'human', type: 'human', content: 'question' },
          { id: 'first', type: 'ai', content: 'stale' },
        ],
      },
      snapshot,
    );
    expect(result.messages.map((message) => message.id)).toEqual([
      'human',
      'first',
      'second',
    ]);
    expect(result.messages[1].content).toBe('finished');
    expect(result.messages[2]).toMatchObject({
      reasoning: [{ text: 'analysis', executionId: 'child' }],
    });
    expect(result.messages[2]).not.toHaveProperty('clientToolCalls');
    expect(result.messages[2]).not.toHaveProperty('inputCheckpoint');
    const state = createLangGraphEventState();
    restoreDisplayEventState(state, snapshot);
    expect(state).toMatchObject({ activeMessageId: 'second' });
    expect(state.responseRuns.get('agent')).toEqual({
      started: true,
      ended: true,
    });
  });
  it('rejects mismatched execution identities, duplicate messages and malformed cursors', () => {
    const wrong = payload();
    wrong.snapshot.messages[0].executionId = 'foreign';
    expect(parseDisplaySnapshot(wrong)).toBeNull();
    const duplicate = payload();
    duplicate.snapshot.messages[0].id = 'second';
    expect(parseDisplaySnapshot(duplicate)).toBeNull();
    const invalid = payload();
    invalid.snapshot.cursor = '$';
    expect(parseDisplaySnapshot(invalid)).toBeNull();
  });
  it('compares Redis cursors without floating-point precision loss', () => {
    expect(
      compareDisplayCursors('9999999999999999999-2', '9999999999999999999-1'),
    ).toBe(1);
    expect(compareDisplayCursors('20-0', '20-0')).toBe(0);
  });
});
