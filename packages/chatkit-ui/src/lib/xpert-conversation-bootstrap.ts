import type {
  ChatConversation,
  Client,
  RuntimeCapabilitiesSelection,
  Thread,
} from '@xpert-ai/xpert-sdk';

import { withConnectorBindingIds } from './conversation-connectors';

export type XpertConversationBootstrapClient = {
  threads: Pick<Client<unknown>['threads'], 'create'> &
    Partial<Pick<Client<unknown>['threads'], 'delete'>>;
  conversations: Pick<Client<unknown>['conversations'], 'create'>;
};

export type XpertConversationBootstrapParams = {
  assistantId: string;
  threadId?: string;
  projectId?: string | null;
  connectorBindingIds?: readonly string[];
  runtimeCapabilities?: RuntimeCapabilitiesSelection | null;
  onThreadCreated?: (threadId: string) => void;
};

export function createAssistantThreadPayload(
  assistantId: string,
  threadId?: string,
) {
  return {
    assistantId,
    ...(threadId ? { threadId, ifExists: 'raise' as const } : {}),
  };
}

export function createConversationPayload(
  threadId: string,
  xpertId: string,
  projectId: string | null | undefined,
  connectorBindingIds: readonly string[] = [],
  conversationId?: string,
  runtimeCapabilities?: RuntimeCapabilitiesSelection | null,
): Partial<ChatConversation> {
  const baseOptions = runtimeCapabilities ? { runtimeCapabilities } : undefined;
  const options = connectorBindingIds.length
    ? withConnectorBindingIds(baseOptions, connectorBindingIds)
    : baseOptions;

  return {
    ...(conversationId ? { id: conversationId } : {}),
    threadId,
    xpertId,
    ...(projectId ? { projectId } : {}),
    ...(options ? { options } : {}),
  };
}

export function getThreadConversationId(
  thread: Pick<Thread, 'metadata'>,
): string | undefined {
  const conversationId = thread.metadata?.id;
  return typeof conversationId === 'string' && conversationId.trim()
    ? conversationId.trim()
    : undefined;
}

export async function createXpertThreadConversation(
  client: XpertConversationBootstrapClient,
  params: XpertConversationBootstrapParams,
) {
  const thread = await client.threads.create(
    createAssistantThreadPayload(params.assistantId, params.threadId),
  );
  const threadId = thread.thread_id?.trim();
  if (!threadId) {
    throw new Error('Thread creation did not return a thread id');
  }
  params.onThreadCreated?.(threadId);

  const conversation = await client.conversations.create(
    createConversationPayload(
      threadId,
      params.assistantId,
      params.projectId,
      params.connectorBindingIds,
      getThreadConversationId(thread),
      params.runtimeCapabilities,
    ),
  );
  return { thread, threadId, conversation };
}
