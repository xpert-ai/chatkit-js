import type {
  ChatGroupEvent,
  ChatGroupMessage,
  ChatGroupSnapshot,
} from '@xpert-ai/xpert-sdk';

export interface GroupState {
  snapshot: ChatGroupSnapshot | null;
  live: Record<string, { runId: string; participantId: string; text: string }>;
}
export const initialGroupState: GroupState = { snapshot: null, live: {} };
export function mergeGroupMessages(
  previous: ChatGroupMessage[],
  incoming: ChatGroupMessage[],
) {
  const messages = new Map(previous.map((message) => [message.id, message]));
  incoming.forEach((message) => messages.set(message.id, message));
  return [...messages.values()].sort((a, b) => a.sequence - b.sequence);
}
export function applyGroupEvent(
  state: GroupState,
  event: ChatGroupEvent,
): GroupState {
  if (event.type === 'resync') return { ...state, live: {} };
  if (event.type === 'text') {
    const previous = state.live[event.messageId];
    return {
      ...state,
      live: {
        ...state.live,
        [event.messageId]: {
          runId: event.runId,
          participantId: event.participantId,
          text: (previous?.text ?? '') + event.text,
        },
      },
    };
  }
  const snapshot = event.snapshot;
  if (state.snapshot && snapshot.revision < state.snapshot.revision)
    return state;
  const runs = new Set(
    snapshot.runs
      .filter((run) => run.status === 'busy' || run.status === 'pausing')
      .map((run) => run.runId),
  );
  return {
    snapshot: {
      ...snapshot,
      messages: mergeGroupMessages(
        state.snapshot?.messages ?? [],
        snapshot.messages,
      ),
      hasMore:
        state.snapshot &&
        state.snapshot.messages[0]?.sequence < snapshot.messages[0]?.sequence
          ? state.snapshot.hasMore
          : snapshot.hasMore,
    },
    live: Object.fromEntries(
      Object.entries(state.live).filter(([, message]) =>
        runs.has(message.runId),
      ),
    ),
  };
}
