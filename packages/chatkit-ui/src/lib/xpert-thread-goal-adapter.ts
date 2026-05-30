import type { Client, ChatConversation } from '@xpert-ai/xpert-sdk';
import type { ChatKitGoalAdapter } from '@xpert-ai/chatkit-types';
import { findConversationByThreadIdWithRetry } from './conversation-runtime-capabilities';

type XpertGoalConversationClient = Partial<
  Pick<
    Client<unknown>['conversations'],
    | 'search'
    | 'create'
    | 'getGoal'
    | 'setGoal'
    | 'updateGoal'
    | 'clearGoal'
  >
>;

export type XpertGoalClient = {
  threads?: Partial<Pick<Client<unknown>['threads'], 'create'>>;
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
      conversations.getGoal &&
      conversations.setGoal &&
      conversations.updateGoal &&
      conversations.clearGoal,
  );
}

async function findConversation(
  client: XpertGoalClient,
  threadId: string,
): Promise<ChatConversation | null> {
  return findConversationByThreadIdWithRetry(
    client as Client<unknown>,
    threadId,
  );
}

async function requireConversation(
  client: XpertGoalClient,
  threadId: string,
): Promise<ChatConversation> {
  const conversation = await findConversation(client, threadId);
  if (!conversation?.id) {
    throw new Error('Conversation not found for this thread.');
  }
  return conversation;
}

export function createXpertThreadGoalAdapter(
  client: XpertGoalClient,
): ChatKitGoalAdapter {
  return {
    async getGoal({ threadId, signal }) {
      const conversation = await findConversation(client, threadId);
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
      const conversation = await createConversation({
        xpertId: assistantId,
        ...(runtimeCapabilities
          ? {
              options: {
                runtimeCapabilities,
              },
            }
          : {}),
      });
      const conversationId = conversation.id?.trim();
      if (!conversationId) {
        throw new Error('Created conversation is missing id.');
      }
      const createdThreadId = conversation.threadId?.trim();
      if (!createdThreadId) {
        throw new Error('Created conversation is missing threadId.');
      }
      const goal = await setGoal(
        conversationId,
        { objective: normalizedObjective },
        { signal },
      );
      return { threadId: createdThreadId, goal };
    },

    async updateGoal({ threadId, objective, status, signal }) {
      const conversation = await requireConversation(client, threadId);
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
      const conversation = await requireConversation(client, threadId);
      const clearGoal = requireBoundGoalMethod(
        client.conversations,
        client.conversations.clearGoal,
      );
      return clearGoal(conversation.id, { signal });
    },
  };
}
