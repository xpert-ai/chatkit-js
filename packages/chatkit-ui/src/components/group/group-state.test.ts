import { describe, expect, it } from 'vitest';
import type { ChatGroupMessage, ChatGroupSnapshot } from '@xpert-ai/xpert-sdk';
import {
  applyGroupEvent,
  initialGroupState,
  mergeGroupMessages,
} from './group-state';
const message = (id: string, sequence: number): ChatGroupMessage => ({
  id,
  sequence,
  clientMessageId: id,
  text: id,
  createdAt: '2026-10-08T00:00:00Z',
  communication: {
    intent: 'request',
    senderId: 'a',
    recipientIds: ['c'],
    rootMessageId: id,
    rootUserId: 'a',
    hop: 0,
  },
  deliveries: [],
});
const snapshot: ChatGroupSnapshot = {
  id: 'd',
  threadId: 'd-thread',
  title: 'D',
  viewerParticipantId: 'b',
  xpertId: 'c',
  members: [],
  messages: [message('m1', 1)],
  hasMore: false,
  revision: 1,
  runs: [
    { runId: 'rc', participantId: 'c', status: 'busy' },
    { runId: 're', participantId: 'e', status: 'busy' },
  ],
};
describe('group stream reconciliation', () => {
  it('deduplicates history and acknowledges messages without erasing concurrent authors', () => {
    expect(
      mergeGroupMessages(
        [message('m1', 1)],
        [message('m2', 2), message('m1', 1)],
      ).map((m) => m.id),
    ).toEqual(['m1', 'm2']);
  });
  it('keeps simultaneous C and E output independent and removes only completed run drafts', () => {
    let state = applyGroupEvent(initialGroupState, {
      type: 'snapshot',
      snapshot,
    });
    state = applyGroupEvent(state, {
      type: 'text',
      participantId: 'c',
      runId: 'rc',
      messageId: 'mc',
      text: 'C ',
    });
    state = applyGroupEvent(state, {
      type: 'text',
      participantId: 'e',
      runId: 're',
      messageId: 'me',
      text: 'E ',
    });
    state = applyGroupEvent(state, {
      type: 'text',
      participantId: 'c',
      runId: 'rc',
      messageId: 'mc',
      text: 'reply',
    });
    expect(state.live.mc.text).toBe('C reply');
    expect(state.live.me.text).toBe('E ');
    state = applyGroupEvent(state, {
      type: 'snapshot',
      snapshot: {
        ...snapshot,
        revision: 2,
        runs: [snapshot.runs[1]],
        messages: [message('m3', 3)],
      },
    });
    expect(state.live.mc).toBeUndefined();
    expect(state.live.me.text).toBe('E ');
    expect(state.snapshot?.messages.map((m) => m.id)).toEqual(['m1', 'm3']);
  });
  it('ignores stale snapshots and clears ephemeral deltas after a replay gap', () => {
    const state = applyGroupEvent(initialGroupState, {
      type: 'snapshot',
      snapshot: { ...snapshot, revision: 3 },
    });
    expect(applyGroupEvent(state, { type: 'snapshot', snapshot })).toBe(state);
    const live = applyGroupEvent(state, {
      type: 'text',
      participantId: 'c',
      runId: 'rc',
      messageId: 'mc',
      text: 'partial',
    });
    expect(applyGroupEvent(live, { type: 'resync' }).live).toEqual({});
  });
});
