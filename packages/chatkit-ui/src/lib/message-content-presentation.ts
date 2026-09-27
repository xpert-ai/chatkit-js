import { isFileActivityContent } from '@xpert-ai/chatkit-types';
import { isThreadContextUsageRenderArtifact } from './thread-context-usage';

/** Content handled outside transcript rows, not a blacklist of internal tools. */
export function isNonTranscriptMessageContent(value: unknown) {
  return (
    // File receipts remain in the message and feed the FileActivity projection.
    isFileActivityContent(value) ||
    // Context usage updates the thread state rather than the conversation text.
    isThreadContextUsageRenderArtifact(value)
  );
}
