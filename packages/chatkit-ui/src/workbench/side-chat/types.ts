import type { ChatReferenceRequest } from '../../components/chat';

export const SIDE_CHAT_VIEW_KEY = 'chatkit.native.side-chat';
export const sideChatViewKey = (id: string) => `${SIDE_CHAT_VIEW_KEY}:${id}`;
export const isSideChatView = (key: string | null) =>
  key === SIDE_CHAT_VIEW_KEY ||
  Boolean(key?.startsWith(`${SIDE_CHAT_VIEW_KEY}:`));

export type SideChatSession = {
  sourceThreadId: string;
  threadId: string;
  /** Selected editing branch; the side-chat identity remains the root thread. */
  selectedThreadId?: string;
  title: string;
  status?: import('@xpert-ai/xpert-sdk').ThreadStatus;
  updatedAt?: string;
  /** A closed tab remains discoverable; visited runtimes retain their drafts. */
  opened?: boolean;
  visited?: boolean;
  referenceRequest?: ChatReferenceRequest;
};
