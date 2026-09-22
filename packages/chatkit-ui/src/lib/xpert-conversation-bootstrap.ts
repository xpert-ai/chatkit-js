import type {
  ChatConversation,
  Client,
  RuntimeCapabilitiesSelection,
  RuntimeResourcesSelection,
  Thread,
} from '@xpert-ai/xpert-sdk';
import type { TChatRequest } from '@xpert-ai/chatkit-types';

import { withConnectorBindingIds } from './conversation-connectors';

export type XpertConversationBootstrapClient = {
  threads: Pick<Client<unknown>['threads'], 'create'> &
    Partial<Pick<Client<unknown>['threads'], 'delete'>>;
  conversations: Pick<Client<unknown>['conversations'], 'create'> &
    Partial<Pick<Client<unknown>['conversations'], 'updateRuntimeResources'>>;
};

export type XpertConversationBootstrapParams = {
  assistantId: string;
  threadId?: string;
  projectId?: string | null;
  connectorBindingIds?: readonly string[];
  runtimeCapabilities?: RuntimeCapabilitiesSelection | null;
  runtimeResources?: RuntimeResourcesSelection;
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
  // Publish the new conversation only after its first selection is committed.
  // Otherwise the UI can read an empty selection before the run saves it.
  let runtimeResources: RuntimeResourcesSelection | undefined;
  if (params.runtimeResources) {
    if (!client.conversations.updateRuntimeResources) {
      throw new Error('The Xpert SDK does not support conversation resources');
    }
    runtimeResources = await client.conversations.updateRuntimeResources(
      conversation.id,
      params.runtimeResources,
    );
  }
  return { thread, threadId, conversation, runtimeResources };
}

export function withPersistedRuntimeResources(
  request: TChatRequest,
  selection: RuntimeResourcesSelection | undefined,
): TChatRequest {
  if (!selection) return request;
  return {
    ...request,
    input: { ...request.input, runtimeResources: selection },
    ...(request.state
      ? {
          state: {
            ...request.state,
            human: { ...request.state.human, runtimeResources: selection },
          },
        }
      : {}),
  };
}
