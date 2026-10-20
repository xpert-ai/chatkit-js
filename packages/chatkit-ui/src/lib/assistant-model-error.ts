import type { AssistantModelSelectionError } from '@xpert-ai/chatkit-types';

function isAssistantModelSelectionError(
  value: unknown,
): value is AssistantModelSelectionError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'statusCode' in value &&
    value.statusCode === 400 &&
    'error' in value &&
    value.error === 'Bad Request' &&
    'code' in value &&
    (value.code === 'ASSISTANT_MODEL_NOT_ALLOWED' ||
      value.code === 'ASSISTANT_MODEL_UNAVAILABLE') &&
    'modelId' in value &&
    typeof value.modelId === 'string' &&
    'message' in value &&
    typeof value.message === 'string'
  );
}

/** Decode the SDK HTTPError body at the HTTP boundary; never infer codes from translated prose. */
export function getAssistantModelSelectionError(
  error: unknown,
): AssistantModelSelectionError | null {
  if (isAssistantModelSelectionError(error)) return error;
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
    return isAssistantModelSelectionError(body) ? body : null;
  } catch {
    return null;
  }
}
