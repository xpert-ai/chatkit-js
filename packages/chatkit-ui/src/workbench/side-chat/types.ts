import type { ChatReferenceRequest } from '../../components/chat';

export const SIDE_CHAT_VIEW_KEY = 'chatkit.native.side-chat';

export type SideChatSession = {
  sourceThreadId: string;
  threadId: string;
  title: string;
  referenceRequest?: ChatReferenceRequest;
};
