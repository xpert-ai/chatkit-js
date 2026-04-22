import { describe, expect, it } from 'vitest';

import {
  buildSteerFollowUpRunInput,
  createPendingFollowUp,
  getBusyComposerShortcutFollowUpMode,
  getComposerFollowUpShortcutLabels,
  mapPersistedPendingFollowUp,
  pendingFollowUpToUiMessage,
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

describe('getBusyComposerShortcutFollowUpMode', () => {
  it('maps Enter to steer and the modifier shortcut to queue', () => {
    expect(getBusyComposerShortcutFollowUpMode(false)).toBe('steer');
    expect(getBusyComposerShortcutFollowUpMode(true)).toBe('queue');
  });
});

describe('getComposerFollowUpShortcutLabels', () => {
  it('always shows Enter for steer and the modifier shortcut for queue', () => {
    expect(getComposerFollowUpShortcutLabels('\u2318Enter')).toEqual({
      steer: 'Enter',
      queue: '\u2318Enter',
    });
  });
});
