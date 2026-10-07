import { describe, expect, it } from 'vitest';
import type { StateType } from '../types';
import { reconcileAgentRun } from './reconcile-agent-run';

describe('reconcile one persisted execution', () => {
  it('updates all message segments without changing parent or sibling execution state or streamed content', () => {
    const state: StateType = {
      messages: [
        {
          id: 'first',
          type: 'ai',
          content: 'Already streamed',
          executionId: 'parent',
          status: 'answering',
          agentRuns: [
            {
              id: 'writer',
              status: 'running',
              title: 'Writer',
              invocationKind: 'external_assistant',
            },
            { id: 'sibling', status: 'running' },
          ],
        },
        {
          id: 'second',
          type: 'ai',
          content: 'More streamed',
          executionId: 'parent',
          status: 'answering',
          agentRuns: [{ id: 'writer', status: 'running' }],
        },
      ],
    };
    const updated = reconcileAgentRun(state, {
      id: 'writer',
      status: 'interrupted',
      elapsedTime: 2700000,
      error: 'Cancelled by user',
    });
    for (const [index, message] of updated.messages.entries()) {
      expect(message).toMatchObject({
        content: state.messages[index].content,
        status: 'answering',
        executionId: 'parent',
      });
      expect(
        message.agentRuns?.find((run) => run.id === 'writer'),
      ).toMatchObject({ status: 'interrupted', elapsedTime: 2700000 });
    }
    expect(updated.messages[0].agentRuns?.[1]).toEqual({
      id: 'sibling',
      status: 'running',
    });
    expect(state.messages[0].agentRuns?.[0].status).toBe('running');
    expect(
      reconcileAgentRun(state, { id: 'unknown', status: 'interrupted' })
        .messages,
    ).toEqual(state.messages);
  });
});
