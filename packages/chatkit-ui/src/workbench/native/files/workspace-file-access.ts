import type {
  WorkspaceFileDocument,
  WorkspaceFileScope,
} from '@xpert-ai/xpert-sdk';

export function workspaceFileScope(runtime: {
  projectId?: string | null;
  conversationId?: string | null;
  assistantId?: string | null;
}): WorkspaceFileScope | null {
  return runtime.projectId
    ? runtime.conversationId
      ? { kind: 'conversation', conversationId: runtime.conversationId }
      : null
    : runtime.assistantId
      ? { kind: 'assistant', assistantId: runtime.assistantId }
      : null;
}

/** Older servers may omit capabilities; absent authority remains read-only. */
export function canWriteWorkspaceFile(
  document: WorkspaceFileDocument,
): boolean {
  return document.capabilities?.canWrite === true;
}
