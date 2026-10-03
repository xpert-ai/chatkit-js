import { describe, expect, it } from 'vitest';
import {
  buildSteerFollowUpRunInput,
  getAutoDrainQueuedFollowUpIds,
  getNextAutoQueuedFollowUp,
  getPendingSteerFollowUpIds,
  getQueuedFollowUpGroup,
  mergeFollowUpHumanInputs,
  mergePendingFollowUps,
  mergeQueuedFollowUpGroup,
} from '../../Stream';

describe('buildSteerFollowUpRunInput', () => {
  it('builds an explicit follow_up request for xpert steer consumption', () => {
    const payload = buildSteerFollowUpRunInput({
      request: {
        id: 'client-message-1',
        input: {
          input: 'Please change direction',
          files: [{ id: 'file-1' }] as unknown as [],
        },
        state: {
          human: {
            input: 'Please change direction',
          },
        },
        executionId: 'run-1',
        followUpMode: 'steer',
      },
      conversationId: 'conversation-1',
      targetExecutionId: 'run-1',
      messages: [
        {
          id: 'ai-1',
          type: 'ai',
          executionId: 'run-1',
          content: 'ongoing answer',
        },
      ],
    });

    expect(payload).toEqual({
      action: 'follow_up',
      conversationId: 'conversation-1',
      mode: 'steer',
      message: {
        clientMessageId: 'client-message-1',
        input: {
          input: 'Please change direction',
          files: [{ id: 'file-1' }],
        },
      },
      target: {
        aiMessageId: 'ai-1',
        executionId: 'run-1',
      },
      state: {
        human: {
          input: 'Please change direction',
        },
      },
    });
  });

  it('returns null when steer follow-up is missing conversation id or text', () => {
    expect(
      buildSteerFollowUpRunInput({
        request: {
          id: 'client-message-1',
          input: {
            input: '   ',
          },
          followUpMode: 'steer',
        },
        conversationId: 'conversation-1',
      }),
    ).toBeNull();

    expect(
      buildSteerFollowUpRunInput({
        request: {
          id: 'client-message-1',
          input: {
            input: 'valid text',
          },
          followUpMode: 'steer',
        },
      }),
    ).toBeNull();
  });
});

describe('getNextAutoQueuedFollowUp', () => {
  it('returns only queue follow-ups that are marked for auto draining', () => {
    expect(
      getNextAutoQueuedFollowUp(
        [
          {
            id: 'manual-queue',
            clientMessageId: 'manual-queue',
            mode: 'queue',
            request: {
              id: 'manual-queue',
              input: { input: 'manual queue' },
              followUpMode: 'queue',
            },
            createdAt: 1,
          },
          {
            id: 'steer',
            clientMessageId: 'steer',
            mode: 'steer',
            request: {
              id: 'steer',
              input: { input: 'steer' },
              followUpMode: 'steer',
            },
            createdAt: 2,
          },
          {
            id: 'auto-queue',
            clientMessageId: 'auto-queue',
            mode: 'queue',
            request: {
              id: 'auto-queue',
              input: { input: 'auto queue' },
              followUpMode: 'queue',
            },
            createdAt: 3,
          },
        ],
        ['auto-queue'],
      ),
    ).toMatchObject({
      id: 'auto-queue',
      mode: 'queue',
    });
  });

  it('drains stale steer follow-ups before older queued follow-ups', () => {
    expect(
      getNextAutoQueuedFollowUp(
        [
          {
            id: 'older-queue',
            clientMessageId: 'older-queue',
            mode: 'queue',
            request: {
              id: 'older-queue',
              input: { input: 'older queue' },
              followUpMode: 'queue',
            },
            createdAt: 1,
          },
          {
            id: 'stale-steer',
            clientMessageId: 'stale-steer',
            mode: 'queue',
            request: {
              id: 'stale-steer',
              input: { input: 'stale steer' },
              followUpMode: 'queue',
            },
            queuedFromSteer: true,
            createdAt: 2,
          },
        ],
        ['older-queue', 'stale-steer'],
      ),
    ).toMatchObject({
      id: 'stale-steer',
      mode: 'queue',
    });
  });

  it('prioritizes promoted steer ids even before queued state has refreshed', () => {
    expect(
      getNextAutoQueuedFollowUp(
        [
          {
            id: 'older-queue',
            clientMessageId: 'older-queue',
            mode: 'queue',
            request: {
              id: 'older-queue',
              input: { input: 'older queue' },
              followUpMode: 'queue',
            },
            createdAt: 1,
          },
          {
            id: 'promoted-steer',
            clientMessageId: 'promoted-steer',
            mode: 'queue',
            request: {
              id: 'promoted-steer',
              input: { input: 'promoted steer' },
              followUpMode: 'queue',
            },
            createdAt: 2,
          },
        ],
        ['older-queue', 'promoted-steer'],
        ['promoted-steer'],
      ),
    ).toMatchObject({
      id: 'promoted-steer',
      mode: 'queue',
    });
  });

  it('drains a queued item promoted by steer before older queued items', () => {
    const items = ['a', 'b', 'c', 'd'].map((suffix, index) => ({
      id: `queue-${suffix}`,
      clientMessageId: `queue-${suffix}`,
      mode: 'queue' as const,
      request: {
        id: `queue-${suffix}`,
        input: { input: suffix },
        followUpMode: 'queue' as const,
      },
      queuedFromSteer: suffix === 'd',
      createdAt: index + 1,
    }));

    expect(
      getNextAutoQueuedFollowUp(
        items,
        items.map((item) => item.id),
        ['queue-d'],
      ),
    ).toMatchObject({
      id: 'queue-d',
      mode: 'queue',
    });
  });

  it('preserves a locally promoted queue item when pending follow-ups refresh from the server', () => {
    const existingItems = [
      {
        id: 'queue-3',
        clientMessageId: 'queue-3',
        mode: 'queue' as const,
        request: {
          id: 'queue-3',
          input: { input: '3-500' },
          followUpMode: 'queue' as const,
        },
        createdAt: 1,
      },
      {
        id: 'queue-4',
        clientMessageId: 'queue-4',
        mode: 'queue' as const,
        request: {
          id: 'queue-4',
          input: { input: '4-500' },
          executionId: 'local-target',
          followUpMode: 'queue' as const,
        },
        targetExecutionId: 'local-target',
        queuedFromSteer: true,
        createdAt: 2,
      },
    ];
    const serverItems = [
      {
        id: 'queue-3',
        clientMessageId: 'queue-3',
        mode: 'queue' as const,
        request: {
          id: 'queue-3',
          input: { input: '3-500' },
          followUpMode: 'queue' as const,
        },
        createdAt: 1,
      },
      {
        id: 'queue-4',
        clientMessageId: 'queue-4',
        mode: 'queue' as const,
        request: {
          id: 'queue-4',
          input: { input: '4-500' },
          followUpMode: 'queue' as const,
        },
        createdAt: 2,
      },
    ];

    const mergedItems = mergePendingFollowUps(existingItems, serverItems);

    expect(mergedItems.find((item) => item.id === 'queue-4')).toMatchObject({
      queuedFromSteer: true,
      request: {
        executionId: 'local-target',
        followUpMode: 'queue',
      },
      targetExecutionId: 'local-target',
    });
    expect(
      getNextAutoQueuedFollowUp(mergedItems, ['queue-3', 'queue-4']),
    ).toMatchObject({
      id: 'queue-4',
      mode: 'queue',
    });
  });

  it('keeps a refreshed steer item internally consistent when preserving local priority metadata', () => {
    const existingItems = [
      {
        id: 'queue-4',
        clientMessageId: 'queue-4',
        mode: 'steer' as const,
        request: {
          id: 'queue-4',
          input: { input: '4-500' },
          executionId: 'local-target',
          followUpMode: 'steer' as const,
        },
        targetExecutionId: 'local-target',
        queuedFromSteer: true,
        createdAt: 1,
      },
    ];
    const serverItems = [
      {
        id: 'queue-4',
        clientMessageId: 'queue-4',
        mode: 'steer' as const,
        request: {
          id: 'queue-4',
          input: { input: '4-500' },
          followUpMode: 'steer' as const,
        },
        createdAt: 1,
      },
    ];

    expect(mergePendingFollowUps(existingItems, serverItems)[0]).toMatchObject({
      mode: 'steer',
      queuedFromSteer: true,
      request: {
        executionId: 'local-target',
        followUpMode: 'steer',
      },
      targetExecutionId: 'local-target',
    });
  });
});

describe('mergeFollowUpHumanInputs', () => {
  it('merges text, files, references, and later human fields in order', () => {
    expect(
      mergeFollowUpHumanInputs([
        {
          input: 'first',
          files: [{ id: 'file-1' }] as unknown as [],
          references: [{ type: 'quote', text: 'A' }] as unknown as [],
          referenceComposition: 'compose',
          custom: 'early',
        },
        {
          input: 'second',
          files: [{ id: 'file-2' }] as unknown as [],
          references: [{ type: 'quote', text: 'B' }] as unknown as [],
          custom: 'late',
        },
      ]),
    ).toEqual({
      input: 'first\n\nsecond',
      files: [{ id: 'file-1' }, { id: 'file-2' }],
      references: [
        { type: 'quote', text: 'A' },
        { type: 'quote', text: 'B' },
      ],
      referenceComposition: 'compose',
      custom: 'late',
    });
  });
});

describe('getQueuedFollowUpGroup', () => {
  it('returns only the selected queued follow-up for the same target execution', () => {
    const items = [
      {
        id: 'queue-2',
        clientMessageId: 'queue-2',
        mode: 'queue' as const,
        targetExecutionId: 'run-1',
        request: {
          id: 'queue-2',
          input: { input: 'second' },
          followUpMode: 'queue' as const,
        },
        createdAt: 2,
      },
      {
        id: 'queue-3',
        clientMessageId: 'queue-3',
        mode: 'queue' as const,
        targetExecutionId: 'run-2',
        request: {
          id: 'queue-3',
          input: { input: 'other run' },
          followUpMode: 'queue' as const,
        },
        createdAt: 3,
      },
      {
        id: 'queue-1',
        clientMessageId: 'queue-1',
        mode: 'queue' as const,
        targetExecutionId: 'run-1',
        request: {
          id: 'queue-1',
          input: { input: 'first' },
          followUpMode: 'queue' as const,
        },
        createdAt: 1,
      },
    ];

    expect(
      getQueuedFollowUpGroup(items, items[0]).map((item) => item.id),
    ).toEqual(['queue-2']);
  });

  it('does not merge queued follow-ups without a target execution id', () => {
    const items = [
      {
        id: 'queue-1',
        clientMessageId: 'queue-1',
        mode: 'queue' as const,
        request: {
          id: 'queue-1',
          input: { input: 'first' },
          followUpMode: 'queue' as const,
        },
        createdAt: 1,
      },
      {
        id: 'queue-2',
        clientMessageId: 'queue-2',
        mode: 'queue' as const,
        request: {
          id: 'queue-2',
          input: { input: 'second' },
          followUpMode: 'queue' as const,
        },
        createdAt: 2,
      },
    ];

    expect(
      getQueuedFollowUpGroup(items, items[0]).map((item) => item.id),
    ).toEqual(['queue-1']);
  });
});

describe('mergeQueuedFollowUpGroup', () => {
  it('creates one merged queued send request while preserving grouped items', () => {
    const result = mergeQueuedFollowUpGroup(
      [
        {
          id: 'queue-1',
          clientMessageId: 'queue-1',
          mode: 'queue',
          targetExecutionId: 'run-1',
          request: {
            id: 'queue-1',
            input: {
              input: 'first',
              files: [{ id: 'file-1' }] as unknown as [],
            },
            state: {
              human: {
                input: 'first',
              },
            },
            followUpMode: 'queue',
          },
          context: {
            source: 'first',
          },
          createdAt: 1,
        },
        {
          id: 'queue-2',
          clientMessageId: 'queue-2',
          mode: 'queue',
          targetExecutionId: 'run-1',
          request: {
            id: 'queue-2',
            input: {
              input: 'second',
              references: [{ type: 'quote', text: 'ref' }] as unknown as [],
            },
            state: {
              human: {
                input: 'second',
              },
            },
            projectId: 'project-1',
            followUpMode: 'queue',
          },
          config: {
            checkpoint: 'latest',
          },
          createdAt: 2,
        },
      ],
      { leadItemId: 'queue-1' },
    );

    expect(result).toMatchObject({
      items: [
        expect.objectContaining({ id: 'queue-1' }),
        expect.objectContaining({ id: 'queue-2' }),
      ],
      request: {
        id: 'queue-1',
        input: {
          input: 'first\n\nsecond',
          files: [{ id: 'file-1' }],
          references: [{ type: 'quote', text: 'ref' }],
        },
        projectId: 'project-1',
        followUpMode: 'queue',
      },
      context: {
        source: 'first',
      },
      config: {
        checkpoint: 'latest',
      },
      targetExecutionId: 'run-1',
    });
  });
});

describe('getAutoDrainQueuedFollowUpIds', () => {
  it('returns queue follow-up ids so persisted pending items auto drain after load', () => {
    expect(
      getAutoDrainQueuedFollowUpIds([
        {
          id: 'queue-1',
          clientMessageId: 'queue-1',
          mode: 'queue',
          request: {
            id: 'queue-1',
            input: { input: 'queued' },
            followUpMode: 'queue',
          },
          createdAt: 1,
        },
        {
          id: 'steer-1',
          clientMessageId: 'steer-1',
          mode: 'steer',
          request: {
            id: 'steer-1',
            input: { input: 'steered' },
            followUpMode: 'steer',
          },
          createdAt: 2,
        },
      ]),
    ).toEqual(['queue-1']);
  });
});

describe('getPendingSteerFollowUpIds', () => {
  it('returns stale steer ids so the stream can auto-queue them when a run finishes', () => {
    expect(
      getPendingSteerFollowUpIds([
        {
          id: 'queue-1',
          clientMessageId: 'queue-1',
          mode: 'queue',
          request: {
            id: 'queue-1',
            input: { input: 'queued' },
            followUpMode: 'queue',
          },
          createdAt: 1,
        },
        {
          id: 'steer-1',
          clientMessageId: 'steer-1',
          mode: 'steer',
          request: {
            id: 'steer-1',
            input: { input: 'steered' },
            followUpMode: 'steer',
          },
          createdAt: 2,
        },
      ]),
    ).toEqual(['steer-1']);
  });

  it('keeps promoted steer ids stale when state has already fallen back to queue', () => {
    expect(
      getPendingSteerFollowUpIds(
        [
          {
            id: 'queue-1',
            clientMessageId: 'queue-1',
            mode: 'queue',
            request: {
              id: 'queue-1',
              input: { input: 'queued' },
              followUpMode: 'queue',
            },
            createdAt: 1,
          },
          {
            id: 'promoted-steer',
            clientMessageId: 'promoted-steer',
            mode: 'queue',
            request: {
              id: 'promoted-steer',
              input: { input: 'steered' },
              followUpMode: 'queue',
            },
            createdAt: 2,
          },
        ],
        ['promoted-steer'],
      ),
    ).toEqual(['promoted-steer']);
  });
});
