import type { Client } from '@xpert-ai/xpert-sdk';

export type {
  ConversationShareAudience,
  ConversationShareSnapshot,
  ConversationSharePreview,
  ConversationShareCreate,
  ConversationShareInfo,
  ConversationShareCreated,
  SharedConversation,
} from '@xpert-ai/xpert-sdk';

export type SharingClient = Pick<Client, 'conversations'>;

export function supportsConversationSharing(
  client: Client,
): client is Client & SharingClient {
  const api = client.conversations;
  return (
    Boolean(api) &&
    'previewShare' in api &&
    typeof api.previewShare === 'function' &&
    'createShare' in api &&
    typeof api.createShare === 'function' &&
    'listShares' in api &&
    typeof api.listShares === 'function' &&
    'revokeShare' in api &&
    typeof api.revokeShare === 'function'
  );
}
