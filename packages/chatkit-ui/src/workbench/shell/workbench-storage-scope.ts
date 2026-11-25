import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import type { WorkbenchRuntime } from '../WorkbenchRuntime';

/** A host-provided non-secret user identity enables cross-conversation preferences. */
export function workbenchStorageScope(
  stream: WorkbenchRuntime,
  options?: ChatKitOptions | null,
) {
  const identity =
    options?.workbench?.preferencesKey ??
    options?.sessionKey ??
    stream.conversationId;
  return identity
    ? JSON.stringify([
        stream.apiUrl,
        stream.organizationId,
        identity,
        stream.assistantId,
        stream.projectId,
      ])
    : undefined;
}
