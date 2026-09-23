import type {
  ChatMessageBranching,
  ChatMessageBranchUnavailableReason,
} from '@xpert-ai/xpert-sdk';

const reasons: readonly ChatMessageBranchUnavailableReason[] = [
  'message_not_complete',
  'checkpoint_unavailable',
  'graph_changed',
  'state_not_supported',
];

export function readMessageBranching(
  value: unknown,
): ChatMessageBranching | undefined {
  if (
    !value ||
    typeof value !== 'object' ||
    !('available' in value) ||
    typeof value.available !== 'boolean'
  )
    return;
  const reason =
    'reason' in value && reasons.find((item) => item === value.reason);
  return { available: value.available, ...(reason ? { reason } : {}) };
}
