import { isFileActivityContent } from '@xpert-ai/chatkit-types';
import { isThreadContextUsageRenderArtifact } from './thread-context-usage';

export function isInternalMessageContent(value: unknown) {
  return isFileActivityContent(value) || isThreadContextUsageRenderArtifact(value);
}
