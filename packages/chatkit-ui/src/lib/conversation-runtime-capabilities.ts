import type {
  ChatConversation,
  Client,
  RuntimeCapabilitiesResponse,
} from '@xpert-ai/xpert-sdk';
import {
  getAvailableRuntimeCapabilitiesSelection,
  hasRuntimeCapabilitySelectionSet,
  type RuntimeCapabilitiesSelection,
  type RuntimeCapabilitiesSelectionSet,
} from './runtime-capabilities';

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

export type ConversationThreadScope = {
  xpertId: string;
  projectId?: string | null;
};

export function createConversationThreadSearchWhere(
  threadId: string,
  scope: ConversationThreadScope,
) {
  return {
    threadId: threadId.trim(),
    xpertId: scope.xpertId.trim(),
    projectId: scope.projectId?.trim() || null,
  };
}

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

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function getAvailableSelectionSet(
  selection: RuntimeCapabilitiesSelectionSet,
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
      ...(selection.connectors?.bindingIds.length
        ? {
            connectors: {
              bindingIds: uniqueStrings(selection.connectors.bindingIds),
            },
          }
        : {}),
    },
    missing: {
      skillIds: skillIds.missing,
      pluginNodeKeys: pluginNodeKeys.missing,
      subAgentNodeKeys: subAgentNodeKeys.missing,
    },
  };
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
  const available = getAvailableSelectionSet(selection, capabilities);
  const recommended = selection.recommended
    ? getAvailableSelectionSet(selection.recommended, capabilities)
    : null;

  return {
    selection: {
      mode: 'allowlist',
      ...(selection.inheritUnselected ? { inheritUnselected: true } : {}),
      skills: available.selection.skills,
      plugins: available.selection.plugins,
      subAgents: available.selection.subAgents,
      ...(recommended && hasRuntimeCapabilitySelectionSet(recommended.selection)
        ? {
            recommended: {
              skills: recommended.selection.skills,
              plugins: recommended.selection.plugins,
              subAgents: recommended.selection.subAgents,
            },
          }
        : {}),
    },
    missing: {
      skillIds: uniqueStrings([
        ...available.missing.skillIds,
        ...(recommended?.missing.skillIds ?? []),
      ]),
      pluginNodeKeys: uniqueStrings([
        ...available.missing.pluginNodeKeys,
        ...(recommended?.missing.pluginNodeKeys ?? []),
      ]),
      subAgentNodeKeys: uniqueStrings([
        ...available.missing.subAgentNodeKeys,
        ...(recommended?.missing.subAgentNodeKeys ?? []),
      ]),
    },
  };
}

export async function findConversationByThreadId(
  client: Client<unknown>,
  threadId: string,
  scope: ConversationThreadScope,
): Promise<ChatConversation | null> {
  const normalizedThreadId = threadId.trim();
  if (!normalizedThreadId) {
    return null;
  }

  const result = await client.conversations.search({
    where: createConversationThreadSearchWhere(normalizedThreadId, scope),
    limit: 1,
  });
  return result.items?.[0] ?? null;
}

export async function findConversationByThreadIdWithRetry(
  client: Client<unknown>,
  threadId: string,
  scope: ConversationThreadScope,
): Promise<ChatConversation | null> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const conversation = await findConversationByThreadId(
      client,
      threadId,
      scope,
    );
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
  xpertId,
  projectId,
  capabilities,
}: {
  client: Client<unknown>;
  threadId: string;
  xpertId: string;
  projectId?: string | null;
  capabilities: RuntimeCapabilitiesResponse;
}): Promise<ConversationRuntimeCapabilitiesLoadResult> {
  const conversation = await findConversationByThreadId(client, threadId, {
    xpertId,
    projectId,
  });
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
  xpertId,
  projectId,
  capabilities,
  selection,
}: {
  client: Client<unknown>;
  threadId: string;
  xpertId: string;
  projectId?: string | null;
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
    { xpertId, projectId },
  );

  if (!conversation?.id) {
    return {
      conversation,
      ...availability,
      updated: false,
    };
  }

  const persistedConnectorBindingIds = uniqueStrings(
    getConversationOptions(conversation)?.runtimeCapabilities?.connectors
      ?.bindingIds ?? [],
  );
  const persistedSelection: RuntimeCapabilitiesSelection = {
    ...availability.selection,
    ...(persistedConnectorBindingIds.length
      ? { connectors: { bindingIds: persistedConnectorBindingIds } }
      : {}),
  };

  await client.conversations.update(conversation.id, {
    options: {
      ...(conversation.options ?? {}),
      runtimeCapabilities:
        getAvailableRuntimeCapabilitiesSelection(persistedSelection),
    },
  });

  return {
    conversation,
    selection: persistedSelection,
    missing: availability.missing,
    updated: true,
  };
}
