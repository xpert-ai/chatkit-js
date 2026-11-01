import type { ChatConversation, Thread } from '@xpert-ai/xpert-sdk';

// Optional for hosts and SDK versions predating the inline conversation projection.
export type ConversationThread = Thread & { conversation?: ChatConversation };

export type LoadedConversation = {
  threadId: string;
  conversation: ChatConversation;
};
