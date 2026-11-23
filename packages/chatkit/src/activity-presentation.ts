/** Visibility of an individual activity within a conversation. */
export type TChatActivityPresentation =
  /** User-facing activity eligible for display in the conversation transcript. */
  | 'event'
  /** Internal execution activity that must stay out of the conversation transcript. */
  | 'runtime';

export function hasRuntimePresentation(
  value: unknown,
): value is { presentation: 'runtime' } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'presentation' in value &&
    value.presentation === 'runtime'
  );
}

export function isRuntimeAgentExecution(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'metadata' in value &&
    hasRuntimePresentation(value.metadata)
  );
}
