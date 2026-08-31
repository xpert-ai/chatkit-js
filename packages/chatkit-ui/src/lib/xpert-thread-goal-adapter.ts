import type { Client, ChatConversation } from '@xpert-ai/xpert-sdk';
import type { ChatKitGoalAdapter } from '@xpert-ai/chatkit-types';
import { findConversationByThreadIdWithRetry } from './conversation-runtime-capabilities';
import type { ConversationThreadScope } from './conversation-runtime-capabilities';
import { createXpertThreadConversation } from './xpert-conversation-bootstrap';

type XpertGoalConversationClient = Partial<
  Pick<
    Client<unknown>['conversations'],
    | 'search'
    | 'create'
    | 'delete'
    | 'getGoal'
    | 'setGoal'
    | 'updateGoal'
    | 'clearGoal'
  >
>;

export type XpertGoalClient = {
  threads?: Partial<Pick<Client<unknown>['threads'], 'create' | 'delete'>>;
  conversations: XpertGoalConversationClient;
};

const SDK_GOAL_METHOD_ERROR =
  'Current Xpert SDK client does not expose conversation goal methods. Provide options.goal to use a custom goal adapter.';

function requireBoundGoalMethod<T extends (...args: never[]) => unknown>(
  owner: unknown | null | undefined,
  method: T | undefined,
): T {
  if (!owner || !method) {
    throw new Error(SDK_GOAL_METHOD_ERROR);
  }
  return method.bind(owner) as T;
}

export function supportsXpertThreadGoalAdapter(
  client: XpertGoalClient,
): boolean {
  const conversations = client.conversations;
  return Boolean(
    conversations?.search &&
    conversations.create &&
    client.threads?.create &&
    conversations.getGoal &&
    conversations.setGoal &&
    conversations.updateGoal &&
    conversations.clearGoal,
  );
}

async function findConversation(
  client: XpertGoalClient,
  threadId: string,
  scope: ConversationThreadScope,
): Promise<ChatConversation | null> {
  return findConversationByThreadIdWithRetry(
    client as Client<unknown>,
    threadId,
    scope,
  );
}

async function requireConversation(
  client: XpertGoalClient,
  threadId: string,
  scope: ConversationThreadScope,
): Promise<ChatConversation> {
  const conversation = await findConversation(client, threadId, scope);
  if (!conversation?.id) {
    throw new Error('Conversation not found for this thread.');
  }
  return conversation;
}

export function createXpertThreadGoalAdapter(
  client: XpertGoalClient,
  scope: ConversationThreadScope,
): ChatKitGoalAdapter {
  return {
    async getGoal({ threadId, signal }) {
      const conversation = await findConversation(client, threadId, scope);
      if (!conversation?.id) {
        return null;
      }
      const getGoal = requireBoundGoalMethod(
        client.conversations,
        client.conversations.getGoal,
      );
      return getGoal(conversation.id, { signal });
    },

    async setGoal({
      threadId,
      assistantId,
      projectId,
      objective,
      runtimeCapabilities,
      signal,
    }) {
      const normalizedObjective = objective.trim();
      if (!normalizedObjective) {
        throw new Error('Goal objective is required.');
      }

      const setGoal = requireBoundGoalMethod(
        client.conversations,
        client.conversations.setGoal,
      );
      const normalizedThreadId = threadId?.trim() || null;
      if (normalizedThreadId) {
        const conversation = await requireConversation(
          client,
          normalizedThreadId,
          {
            xpertId: scope.xpertId,
            projectId: projectId ?? scope.projectId,
          },
        );
        const goal = await setGoal(
          conversation.id,
          { objective: normalizedObjective },
          { signal },
        );
        return { threadId: normalizedThreadId, goal };
      }

      const createConversation = requireBoundGoalMethod(
        client.conversations,
        client.conversations?.create,
      );
      const createThread = requireBoundGoalMethod(
        client.threads,
        client.threads?.create,
      );
      const deleteThread = client.threads?.delete?.bind(client.threads);
      let createdThreadId: string | null = null;
      let created: Awaited<ReturnType<typeof createXpertThreadConversation>>;
      try {
        created = await createXpertThreadConversation(
          {
            threads: {
              create: createThread,
              ...(deleteThread ? { delete: deleteThread } : {}),
            },
            conversations: { create: createConversation },
          },
          {
            assistantId,
            projectId,
            runtimeCapabilities,
            onThreadCreated: (resolvedThreadId) => {
              createdThreadId = resolvedThreadId;
            },
          },
        );
      } catch (error) {
        if (createdThreadId) {
          try {
            await client.threads?.delete?.call(client.threads, createdThreadId);
          } catch {
            // Preserve the creation error; incomplete thread cleanup is best effort.
          }
        }
        throw error;
      }
      const conversation = created.conversation;
      const conversationId = conversation.id?.trim();
      try {
        if (!conversationId) {
          throw new Error('Created conversation is missing id.');
        }
        const goal = await setGoal(
          conversationId,
          { objective: normalizedObjective },
          { signal },
        );
        return { threadId: created.threadId, goal };
      } catch (error) {
        if (conversationId) {
          try {
            await client.conversations.delete?.call(
              client.conversations,
              conversationId,
            );
          } catch {
            // Preserve the goal error; incomplete conversation cleanup is best effort.
          }
        }
        try {
          await client.threads?.delete?.call(client.threads, created.threadId);
        } catch {
          // Preserve the goal error; incomplete thread cleanup is best effort.
        }
        throw error;
      }
    },

    async updateGoal({ threadId, objective, status, signal }) {
      const conversation = await requireConversation(client, threadId, scope);
      const updateGoal = requireBoundGoalMethod(
        client.conversations,
        client.conversations.updateGoal,
      );
      return updateGoal(
        conversation.id,
        {
          ...(objective !== undefined ? { objective } : {}),
          ...(status ? { status } : {}),
        },
        { signal },
      );
    },

    async clearGoal({ threadId, signal }) {
      const conversation = await requireConversation(client, threadId, scope);
      const clearGoal = requireBoundGoalMethod(
        client.conversations,
        client.conversations.clearGoal,
      );
      return clearGoal(conversation.id, { signal });
    },
  };
}
