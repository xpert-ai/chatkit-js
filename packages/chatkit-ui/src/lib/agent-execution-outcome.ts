import type { TAgentExecutionOutcome } from '@xpert-ai/chatkit-types';

/** Validate the shared server result at the live/history JSON boundary. */
export function parseAgentExecutionOutcome(
  value: unknown,
): TAgentExecutionOutcome | undefined {
  if (
    !value ||
    typeof value !== 'object' ||
    !('status' in value) ||
    !('subjectId' in value) ||
    typeof value.subjectId !== 'string' ||
    !value.subjectId ||
    !('accepted' in value) ||
    typeof value.accepted !== 'boolean'
  )
    return;
  const status = value.status;
  if (
    status !== 'accepted' &&
    status !== 'already_completed' &&
    status !== 'not_claimed' &&
    status !== 'blocked' &&
    status !== 'failed' &&
    status !== 'incomplete'
  )
    return;
  if (
    value.accepted !== (status === 'accepted' || status === 'already_completed')
  )
    return;
  return {
    status,
    subjectId: value.subjectId,
    accepted: value.accepted,
    ...('message' in value && typeof value.message === 'string'
      ? { message: value.message.slice(0, 1500) }
      : {}),
    ...('versionId' in value && typeof value.versionId === 'string'
      ? { versionId: value.versionId }
      : {}),
  };
}
