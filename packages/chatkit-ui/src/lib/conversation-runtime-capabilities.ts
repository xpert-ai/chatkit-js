import type {
  ChatConversation,
  Client,
  RuntimeCapabilitiesResponse,
  RuntimeCapabilitiesSelection,
} from '@xpert-ai/xpert-sdk';

export type ConversationRuntimeCapabilitiesOptions = Record<string, unknown> & {
  runtimeCapabilities?: RuntimeCapabilitiesSelection | null;
};

export type ConversationWithRuntimeCapabilities = Omit<
  ChatConversation,
  'options'
> & {
  options?: ConversationRuntimeCapabilitiesOptions;
};

export type MissingRuntimeCapabilityReferences = {
  skillIds: string[];
  pluginNodeKeys: string[];
  subAgentNodeKeys: string[];
};

export type RuntimeCapabilitiesSelectionAvailability = {
  selection: RuntimeCapabilitiesSelection;
  missing: MissingRuntimeCapabilityReferences;
};

export type ConversationRuntimeCapabilitiesLoadResult = {
  conversation: ChatConversation | null;
  selection: RuntimeCapabilitiesSelection | null;
  missing: MissingRuntimeCapabilityReferences;
};

export type ConversationRuntimeCapabilitiesPersistResult = {
  conversation: ChatConversation | null;
  selection: RuntimeCapabilitiesSelection;
  missing: MissingRuntimeCapabilityReferences;
  updated: boolean;
};

const emptyMissingRuntimeCapabilityReferences: MissingRuntimeCapabilityReferences =
  {
    skillIds: [],
    pluginNodeKeys: [],
    subAgentNodeKeys: [],
  };

function getConversationOptions(
  conversation: ChatConversation | null | undefined,
): ConversationRuntimeCapabilitiesOptions | null {
  return (
    (conversation as ConversationWithRuntimeCapabilities | null | undefined)
      ?.options ?? null
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitByAvailability(
  values: readonly string[],
  availableValues: readonly string[],
) {
  const available = new Set(availableValues);
  const found: string[] = [];
  const missing: string[] = [];

  for (const value of values) {
    if (available.has(value)) {
      found.push(value);
    } else {
      missing.push(value);
    }
  }

  return { found, missing };
}

export function hasMissingRuntimeCapabilityReferences(
  missing: MissingRuntimeCapabilityReferences,
) {
  return (
    missing.skillIds.length > 0 ||
    missing.pluginNodeKeys.length > 0 ||
    missing.subAgentNodeKeys.length > 0
  );
}

export function getRuntimeCapabilitiesSelectionAvailability(
  selection: RuntimeCapabilitiesSelection,
  capabilities: RuntimeCapabilitiesResponse,
): RuntimeCapabilitiesSelectionAvailability {
  const skillIds = splitByAvailability(
    selection.skills.ids,
    capabilities.skills.map((skill) => skill.id),
  );
  const pluginNodeKeys = splitByAvailability(
    selection.plugins.nodeKeys,
    capabilities.plugins.map((plugin) => plugin.nodeKey),
  );
  const subAgentNodeKeys = splitByAvailability(
    selection.subAgents?.nodeKeys ?? [],
    capabilities.subAgents?.map((subAgent) => subAgent.nodeKey) ?? [],
  );

  return {
    selection: {
      mode: 'allowlist',
      skills: {
        ...(selection.skills.workspaceId
          ? { workspaceId: selection.skills.workspaceId }
          : {}),
        ids: skillIds.found,
      },
      plugins: {
        nodeKeys: pluginNodeKeys.found,
      },
      subAgents: {
        nodeKeys: subAgentNodeKeys.found,
      },
    },
    missing: {
      skillIds: skillIds.missing,
      pluginNodeKeys: pluginNodeKeys.missing,
      subAgentNodeKeys: subAgentNodeKeys.missing,
    },
  };
}

export async function findConversationByThreadId(
  client: Client<unknown>,
  threadId: string,
): Promise<ChatConversation | null> {
  const normalizedThreadId = threadId.trim();
  if (!normalizedThreadId) {
    return null;
  }

  const result = await client.conversations.search({
    where: { threadId: normalizedThreadId },
    limit: 1,
  });
  return result.items?.[0] ?? null;
}

export async function findConversationByThreadIdWithRetry(
  client: Client<unknown>,
  threadId: string,
): Promise<ChatConversation | null> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const conversation = await findConversationByThreadId(client, threadId);
    if (conversation?.id) {
      return conversation;
    }
    if (attempt < 4) {
      await wait(250);
    }
  }
  return null;
}

export async function loadConversationRuntimeCapabilities({
  client,
  threadId,
  capabilities,
}: {
  client: Client<unknown>;
  threadId: string;
  capabilities: RuntimeCapabilitiesResponse;
}): Promise<ConversationRuntimeCapabilitiesLoadResult> {
  const conversation = await findConversationByThreadId(client, threadId);
  const persistedSelection =
    getConversationOptions(conversation)?.runtimeCapabilities ?? null;

  if (!persistedSelection) {
    return {
      conversation,
      selection: null,
      missing: emptyMissingRuntimeCapabilityReferences,
    };
  }

  const availability = getRuntimeCapabilitiesSelectionAvailability(
    persistedSelection,
    capabilities,
  );

  return {
    conversation,
    ...availability,
  };
}

export async function persistConversationRuntimeCapabilities({
  client,
  threadId,
  capabilities,
  selection,
}: {
  client: Client<unknown>;
  threadId: string;
  capabilities: RuntimeCapabilitiesResponse;
  selection: RuntimeCapabilitiesSelection;
}): Promise<ConversationRuntimeCapabilitiesPersistResult> {
  const availability = getRuntimeCapabilitiesSelectionAvailability(
    selection,
    capabilities,
  );
  const conversation = await findConversationByThreadIdWithRetry(
    client,
    threadId,
  );

  if (!conversation?.id) {
    return {
      conversation,
      ...availability,
      updated: false,
    };
  }

  await client.conversations.update(conversation.id, {
    options: {
      ...(conversation.options ?? {}),
      runtimeCapabilities: availability.selection,
    },
  });

  return {
    conversation,
    ...availability,
    updated: true,
  };
}
