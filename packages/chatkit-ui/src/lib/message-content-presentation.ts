import {
  hasRuntimePresentation,
  isFileActivityContent,
  isResourceCardContent,
} from '@xpert-ai/chatkit-types';
import { isThreadContextUsageRenderArtifact } from './thread-context-usage';

/** Content handled outside transcript rows, not a blacklist of internal tools. */
export function isNonTranscriptMessageContent(value: unknown) {
  return (
    (typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      value.type === 'agent_event' &&
      'data' in value &&
      hasRuntimePresentation(value.data)) ||
    isResourceCardContent(value) ||
    // File receipts remain in the message and feed the FileActivity projection.
    isFileActivityContent(value) ||
    // Context usage updates the thread state rather than the conversation text.
    isThreadContextUsageRenderArtifact(value)
  );
}
