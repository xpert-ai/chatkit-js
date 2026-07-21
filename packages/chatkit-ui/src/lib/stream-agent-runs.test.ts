import { describe, expect, it } from 'vitest';

import {
  interruptActiveAgentRunOnMessages,
  interruptRunningAgentRuns,
} from './stream-agent-runs';

describe('interruptRunningAgentRuns', () => {
  it('interrupts running agents and freezes their elapsed time', () => {
    const interruptedAt = Date.parse('2026-07-21T08:05:06.000Z');

    expect(
      interruptRunningAgentRuns(
        [
          {
            id: 'running-agent',
            status: 'running',
            createdAt: '2026-07-21T08:05:00.000Z',
          },
          {
            id: 'completed-agent',
            status: 'success',
            elapsedTime: 2_000,
          },
        ],
        interruptedAt,
      ),
    ).toEqual([
      {
        id: 'running-agent',
        status: 'interrupted',
        createdAt: '2026-07-21T08:05:00.000Z',
        endedAt: '2026-07-21T08:05:06.000Z',
        updatedAt: '2026-07-21T08:05:06.000Z',
        elapsedTime: 6_000,
      },
      {
        id: 'completed-agent',
        status: 'success',
        elapsedTime: 2_000,
      },
    ]);
  });
});

describe('interruptActiveAgentRunOnMessages', () => {
  it('does not modify historical messages when stop is idle', () => {
    const messages = [
      {
        type: 'ai',
        executionId: 'historical-run',
        status: 'success',
        agentRuns: [{ id: 'completed-agent', status: 'success' }],
      },
    ];

    const nextMessages = interruptActiveAgentRunOnMessages(messages, {
      activeRunId: 'historical-run',
      hasActiveRun: false,
    });

    expect(nextMessages).toBe(messages);
    expect(nextMessages).toEqual([
      {
        type: 'ai',
        executionId: 'historical-run',
        status: 'success',
        agentRuns: [{ id: 'completed-agent', status: 'success' }],
      },
    ]);
  });

  it('interrupts the assistant message containing a running agent run', () => {
    const interruptedAt = Date.parse('2026-07-21T08:05:06.000Z');
    const messages = [
      {
        type: 'ai',
        executionId: 'active-run',
        status: 'streaming',
        agentRuns: [
          {
            id: 'running-agent',
            status: 'running',
            createdAt: '2026-07-21T08:05:00.000Z',
          },
        ],
      },
      {
        type: 'ai',
        executionId: 'newer-history',
        status: 'success',
      },
    ];

    expect(
      interruptActiveAgentRunOnMessages(messages, {
        activeRunId: null,
        hasActiveRun: true,
        interruptedAt,
      }),
    ).toEqual([
      {
        type: 'ai',
        executionId: 'active-run',
        status: 'aborted',
        agentRuns: [
          {
            id: 'running-agent',
            status: 'interrupted',
            createdAt: '2026-07-21T08:05:00.000Z',
            endedAt: '2026-07-21T08:05:06.000Z',
            updatedAt: '2026-07-21T08:05:06.000Z',
            elapsedTime: 6_000,
          },
        ],
      },
      {
        type: 'ai',
        executionId: 'newer-history',
        status: 'success',
      },
    ]);
  });

  it('interrupts the assistant message matching the active run id', () => {
    const messages = [
      {
        type: 'ai',
        executionId: 'active-run',
        status: 'streaming',
      },
      {
        type: 'human',
        executionId: 'active-run',
        status: 'queued',
      },
      {
        type: 'ai',
        executionId: 'newer-history',
        status: 'success',
      },
    ];

    expect(
      interruptActiveAgentRunOnMessages(messages, {
        activeRunId: 'active-run',
        hasActiveRun: true,
      }),
    ).toEqual([
      {
        type: 'ai',
        executionId: 'active-run',
        status: 'aborted',
        agentRuns: undefined,
      },
      {
        type: 'human',
        executionId: 'active-run',
        status: 'queued',
      },
      {
        type: 'ai',
        executionId: 'newer-history',
        status: 'success',
      },
    ]);
  });
});
