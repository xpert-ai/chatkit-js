import { Client, type ChatConversation } from '@xpert-ai/xpert-sdk';
import type { ConversationActionContext } from '../../src/components/conversation/conversation-actions';
import type { ThreadItem } from '../../src/hooks/useThreads';

// SDK methods are replaced with synthetic data; the preview performs no platform requests.
const client = new Client({ apiUrl: 'https://example.invalid' });
const detail: ChatConversation = {
  id: 'preview-conversation',
  threadId: 'preview-main',
  title: 'Deployment review',
  status: 'idle',
};
client.conversations.get = async () => detail;
client.conversations.getSidebar = async () => ({
  pinned: false,
  archived: false,
});
client.conversations.searchMessages = async () => ({
  items: [
    { id: 'question', role: 'user', content: 'Preview question' },
    {
      id: 'reply',
      role: 'assistant',
      content: 'Preview reply',
      branching: { available: true },
    },
  ],
  total: 2,
});
export const target: ThreadItem = {
  recordId: detail.id,
  id: detail.threadId!,
  title: detail.title!,
  status: 'idle',
};
export const context: ConversationActionContext = {
  client,
  scopeKey: 'menu-preview',
  ready: true,
  activeConversationId: detail.id,
  activeThreadId: detail.threadId!,
  running: false,
  history: {},
  branchEnabled: true,
  rename: async () => {},
  delete: async () => {},
  navigate: () => {},
  sideChat: async () => {},
  setSidebar: async () => ({ pinned: false, archived: false }),
};
