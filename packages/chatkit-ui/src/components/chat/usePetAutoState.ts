import * as React from 'react';
import type {
  ChatkitMessage,
  ChatKitPetAnimationName,
} from '@xpert-ai/chatkit-types';
import { getAssistantStreamingStatus } from '../../lib/message';

type PetAutoStateMessage = {
  type: unknown;
};

export type UsePetAutoStateArgs = {
  currentThreadStatus?: string | null;
  currentThreadIsRunning: boolean;
  isClientSecretInitializing: boolean;
  isHistoryLoading: boolean;
  isStreamLoading: boolean;
  isStreamReady: boolean;
  lastStreamOutputAt: number | null;
  messages: readonly PetAutoStateMessage[];
  now: number;
  threadErrorMessage?: string;
};

export function usePetAutoState({
  currentThreadStatus,
  currentThreadIsRunning,
  isClientSecretInitializing,
  isHistoryLoading,
  isStreamLoading,
  isStreamReady,
  lastStreamOutputAt,
  messages,
  now,
  threadErrorMessage,
}: UsePetAutoStateArgs): ChatKitPetAnimationName {
  const lastAssistantStreamingStatus = React.useMemo(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || !isStreamLoading) {
      return null;
    }

    const lastMessageType = String(lastMessage.type);
    if (lastMessageType !== 'assistant' && lastMessageType !== 'ai') {
      return null;
    }

    return getAssistantStreamingStatus(
      {
        ...(lastMessage as ChatkitMessage),
        lastStreamOutputAt,
      },
      true,
      { now },
    );
  }, [isStreamLoading, lastStreamOutputAt, messages, now]);

  return React.useMemo<ChatKitPetAnimationName>(() => {
    if (threadErrorMessage || currentThreadStatus === 'error') {
      return 'failed';
    }

    if (isClientSecretInitializing || !isStreamReady || isHistoryLoading) {
      return 'waiting';
    }

    if (isStreamLoading) {
      return lastAssistantStreamingStatus === 'answering' ||
        lastAssistantStreamingStatus === 'thinking'
        ? 'review'
        : 'running';
    }

    if (currentThreadIsRunning) {
      return 'running';
    }

    return 'idle';
  }, [
    currentThreadIsRunning,
    currentThreadStatus,
    isClientSecretInitializing,
    isHistoryLoading,
    isStreamLoading,
    isStreamReady,
    lastAssistantStreamingStatus,
    threadErrorMessage,
  ]);
}
