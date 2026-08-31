import type {
  ChatConversation,
  ChatConversationOptions,
  Client,
} from '@xpert-ai/xpert-sdk';

import type { RuntimeCapabilitiesSelection } from './runtime-capabilities';

type ConversationConnectorOptions = ChatConversationOptions & {
  runtimeCapabilities?: RuntimeCapabilitiesSelection | null;
};

function uniqueBindingIds(bindingIds: readonly string[]) {
  return Array.from(
    new Set(bindingIds.map((bindingId) => bindingId.trim()).filter(Boolean)),
  );
}

export function getConversationConnectorBindingIds(
  conversation: ChatConversation | null | undefined,
) {
  return uniqueBindingIds(
    conversation?.options?.runtimeCapabilities?.connectors?.bindingIds ?? [],
  );
}

export function withConnectorBindingIds(
  options: ConversationConnectorOptions | null | undefined,
  bindingIds: readonly string[],
): ConversationConnectorOptions {
  const normalizedBindingIds = uniqueBindingIds(bindingIds);
  const current = options?.runtimeCapabilities;
  const runtimeCapabilities: RuntimeCapabilitiesSelection = current ?? {
    mode: 'allowlist',
    inheritUnselected: true,
    skills: { ids: [] },
    plugins: { nodeKeys: [] },
  };

  return {
    ...(options ?? {}),
    runtimeCapabilities: {
      ...runtimeCapabilities,
      ...(normalizedBindingIds.length
        ? { connectors: { bindingIds: normalizedBindingIds } }
        : { connectors: undefined }),
    },
  };
}

export async function persistConversationConnectorBindingIds({
  client,
  conversation,
  bindingIds,
}: {
  client: Client<unknown>;
  conversation: ChatConversation;
  bindingIds: readonly string[];
}) {
  return client.conversations.update(conversation.id, {
    options: withConnectorBindingIds(conversation.options, bindingIds),
  });
}
