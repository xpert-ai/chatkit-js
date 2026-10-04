import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ProjectSelection } from './stream/types';

import { StreamSession } from './stream/StreamSession';

export {
  buildSteerFollowUpRunInput,
  getAutoDrainQueuedFollowUpIds,
  getNextAutoQueuedFollowUp,
  getPendingSteerFollowUpIds,
  getQueuedFollowUpGroup,
  mergeFollowUpHumanInputs,
  mergeQueuedFollowUpGroup,
} from '../lib/follow-ups';
export type { PendingHITLRequest } from '../lib/hitl';
export {
  createAssistantThreadPayload,
  createConversationPayload,
  getThreadConversationId,
} from '../lib/xpert-conversation-bootstrap';
export {
  createFetchWithClientSecretRefresh,
  createLanguageHeaders,
} from './stream/auth/client-secret';
export { default, useStreamContext } from './stream/context';
export { applyStreamEvent } from './stream/events/apply-stream-event';
export { mergePendingFollowUps } from './stream/follow-ups/merge';
export {
  createConversationMessagesPageQuery,
  mergeHistoryUiMessages,
  normalizeConversationMessagesPage,
} from './stream/history/pagination';
export {
  getRequestUserInputResultPurpose,
  normalizeRequestUserInputParams,
  normalizeRequestUserInputToolCall,
  normalizeToolMessagesResponse,
  resolveClientToolCallResponse,
} from './stream/interrupts/client-tools';
export { shouldBroadcastThreadChange } from './stream/scope/thread-identity';
export { shouldIgnoreStreamError } from './stream/transport/errors';
export {
  mergeStreamRequestContext,
  retainResumeStreamOptions,
  withConversationScope,
} from './stream/transport/request-options';
export {
  type HistoryMessagePaginationState,
  type PendingRequestUserInput,
  type StateType,
  type StreamContextType,
  type StreamSubmitOptions,
} from './stream/types';

const defaultApiUrl =
  (import.meta.env.VITE_XPERTAI_API_URL as string | undefined) ??
  'https://api.xpertai.cn/api/ai';

export const StreamProvider: React.FC<{
  children: ReactNode;
  apiKey?: string;
  organizationId?: string;
  apiUrl?: string;
  xpertId?: string;
  projectId?: string;
  projectSelection?: ProjectSelection;
  initialThread?: string | null;
  runtimeKey?: string | number;
  locale?: string | null;
  additionalContext?: Record<string, unknown>;
  threadStateMode?: 'url' | 'memory';
  hostIntegration?: boolean;
  getClientSecret?: () => Promise<{ secret: string; organizationId?: string }>;
}> = ({
  children,
  apiKey,
  organizationId,
  apiUrl,
  xpertId,
  projectId,
  projectSelection,
  initialThread,
  runtimeKey,
  locale,
  additionalContext,
  threadStateMode = 'url',
  hostIntegration = true,
  getClientSecret,
}) => {
  const assistantId = xpertId?.trim() || 'your-xpert-id';
  const normalizedProjectId = projectId?.trim() || undefined;
  const hasClientSecret = Boolean(apiKey?.trim());
  const [credentialSession, setCredentialSession] = useState({
    hasClientSecret,
    generation: 0,
  });
  if (credentialSession.hasClientSecret !== hasClientSecret) {
    // Initial credentials must preserve host callbacks. Clearing credentials
    // still replaces the session so a signed-out host cannot retain its views.
    setCredentialSession({
      hasClientSecret,
      generation: credentialSession.generation + (hasClientSecret ? 0 : 1),
    });
  }
  const streamScopeKey = JSON.stringify([
    apiUrl,
    organizationId,
    assistantId,
    credentialSession.generation,
  ]);
  const previousStreamScopeKeyRef = useRef(streamScopeKey);
  const resetThreadOnMount =
    previousStreamScopeKeyRef.current !== streamScopeKey;

  useEffect(() => {
    previousStreamScopeKeyRef.current = streamScopeKey;
  }, [streamScopeKey]);

  return (
    <StreamSession
      key={streamScopeKey}
      apiKey={apiKey ?? ''}
      organizationId={organizationId}
      apiUrl={apiUrl ?? defaultApiUrl}
      assistantId={assistantId}
      projectId={normalizedProjectId}
      projectSelection={projectSelection}
      initialThread={initialThread}
      locale={locale}
      additionalContext={additionalContext}
      threadStateMode={threadStateMode}
      hostIntegration={hostIntegration}
      resetThreadOnMount={resetThreadOnMount}
      runtimeKey={runtimeKey}
      getClientSecret={getClientSecret}
    >
      {children}
    </StreamSession>
  );
};
