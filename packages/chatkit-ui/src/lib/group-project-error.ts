import type { GroupProjectRequiredError } from '@xpert-ai/chatkit-types';

function isGroupProjectRequiredError(
  value: unknown,
): value is GroupProjectRequiredError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'statusCode' in value &&
    value.statusCode === 400 &&
    'error' in value &&
    value.error === 'Bad Request' &&
    'code' in value &&
    value.code === 'GROUP_PROJECT_REQUIRED' &&
    'message' in value &&
    typeof value.message === 'string' &&
    'groupId' in value &&
    typeof value.groupId === 'string' &&
    'participantIds' in value &&
    Array.isArray(value.participantIds) &&
    value.participantIds.length > 0 &&
    value.participantIds.every((id: unknown) => typeof id === 'string')
  );
}

/** SDK HTTPError boundary: match the typed code, never translated error text. */
export function getGroupProjectRequiredError(
  error: unknown,
): GroupProjectRequiredError | null {
  if (isGroupProjectRequiredError(error)) return error;
  if (
    typeof error !== 'object' ||
    error === null ||
    !('status' in error) ||
    error.status !== 400 ||
    !('text' in error) ||
    typeof error.text !== 'string'
  )
    return null;
  try {
    const body: unknown = JSON.parse(error.text);
    return isGroupProjectRequiredError(body) ? body : null;
  } catch {
    return null;
  }
}
