import { describe, expect, it } from 'vitest';

import {
  buildSteerFollowUpRunInput,
  createPendingFollowUp,
  mapPersistedPendingFollowUp,
  movePendingFollowUpBeforeQueuedItems,
  pendingFollowUpToUiMessage,
  sortVisiblePendingFollowUps,
} from './follow-ups';

describe('createPendingFollowUp', () => {
  it('accepts reference-only human input', () => {
    const pending = createPendingFollowUp(
      {
        id: 'client-message-1',
        input: {
          input: '',
          referenceComposition: 'compose',
          references: [
            {
              type: 'code',
              path: 'src/example.ts',
              startLine: 3,
              endLine: 7,
              text: 'console.log("hello")',
            },
          ],
        },
        followUpMode: 'queue',
      },
      'queue',
    );

    expect(pending).toMatchObject({
      id: 'client-message-1',
      mode: 'queue',
      request: {
        input: {
          input: '',
          referenceComposition: 'compose',
          references: [
            expect.objectContaining({
              type: 'code',
              path: 'src/example.ts',
            }),
          ],
        },
      },
    });
  });
});

describe('mapPersistedPendingFollowUp', () => {
  it('rehydrates references from persisted hidden pending messages', () => {
    const pending = mapPersistedPendingFollowUp({
      id: 'server-message-1',
      role: 'human',
      content: 'Referenced content',
      createdAt: '2026-03-12T00:00:00.000Z',
      followUpMode: 'queue',
      followUpStatus: 'pending',
      state: {
        human: {
          input: '',
          referenceComposition: 'compose',
          references: [
            {
              path: 'src/example.ts',
              startLine: 10,
              endLine: 12,
              text: 'return answer;',
            },
          ],
        },
      },
    } as any);

    expect(pending).toMatchObject({
      mode: 'queue',
      request: {
        input: {
          input: '',
          referenceComposition: 'compose',
          references: [
            expect.objectContaining({
              type: 'code',
              path: 'src/example.ts',
            }),
          ],
        },
      },
    });

    expect(pending).not.toBeNull();
    if (!pending) {
      return;
    }

    expect(pendingFollowUpToUiMessage(pending)).toMatchObject({
      type: 'human',
      content: '',
      referenceComposition: 'compose',
      references: [
        expect.objectContaining({
          type: 'code',
          path: 'src/example.ts',
        }),
      ],
      submittedInput: '',
    });
  });
});

describe('buildSteerFollowUpRunInput', () => {
  it('accepts reference-only steer payloads', () => {
    const payload = buildSteerFollowUpRunInput({
      request: {
        id: 'client-message-2',
        input: {
          input: '',
          referenceComposition: 'compose',
          references: [
            {
              type: 'quote',
              source: 'Assistant',
              text: 'Use the previous answer as context.',
            },
          ],
        },
        followUpMode: 'steer',
      },
      conversationId: 'conversation-1',
      targetExecutionId: 'run-1',
      messages: [
        {
          id: 'ai-1',
          type: 'ai',
        },
      ],
    });

    expect(payload).toEqual({
      action: 'follow_up',
      conversationId: 'conversation-1',
      mode: 'steer',
      message: {
        clientMessageId: 'client-message-2',
        input: {
          input: '',
          referenceComposition: 'compose',
          references: [
            {
              type: 'quote',
              source: 'Assistant',
              text: 'Use the previous answer as context.',
            },
          ],
        },
      },
      target: {
        aiMessageId: 'ai-1',
        executionId: 'run-1',
      },
    });
  });
});

describe('pending follow-up ordering', () => {
  it('shows steer follow-ups before older queued follow-ups', () => {
    const items = [
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
        id: 'steer-4',
        clientMessageId: 'steer-4',
        mode: 'steer' as const,
        request: {
          id: 'steer-4',
          input: { input: '4-500' },
          followUpMode: 'steer' as const,
        },
        createdAt: 2,
      },
    ];

    expect(sortVisiblePendingFollowUps(items).map((item) => item.id)).toEqual([
      'steer-4',
      'queue-3',
    ]);
  });

  it('moves a promoted steer follow-up before existing queued follow-ups', () => {
    const items = ['a', 'b', 'c', 'd'].map((suffix, index) => ({
      id: `queue-${suffix}`,
      clientMessageId: `queue-${suffix}`,
      mode: 'queue' as const,
      request: {
        id: `queue-${suffix}`,
        input: { input: suffix },
        followUpMode: 'queue' as const,
      },
      createdAt: index + 1,
    }));

    const promotedItem = {
      ...items[3],
      mode: 'steer' as const,
      request: {
        ...items[3].request,
        followUpMode: 'steer' as const,
      },
      queuedFromSteer: true,
    };

    expect(
      movePendingFollowUpBeforeQueuedItems(
        items,
        promotedItem.id,
        promotedItem,
      ).map((item) => item.id),
    ).toEqual(['queue-d', 'queue-a', 'queue-b', 'queue-c']);
  });
});
