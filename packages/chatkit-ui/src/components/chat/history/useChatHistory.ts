import * as React from 'react';
import { useMessageHistory } from '../../../hooks/useMessageHistory';
import {
  useThreads,
  type ThreadHistoryProject,
  type ThreadHistoryScope,
} from '../../../hooks/useThreads';
import type { useChatEnvironment } from '../session/useChatEnvironment';

type ChatHistoryOptions = Pick<
  ReturnType<typeof useChatEnvironment>,
  'activeProjectId' | 'history' | 'missingConfig' | 't'
> & {
  surface: 'main' | 'side';
  stream: Pick<
    ReturnType<typeof useChatEnvironment>['stream'],
    'client' | 'assistantId' | 'isReady' | 'threadId' | 'conversationId'
  >;
};

export function useChatHistory({
  activeProjectId,
  surface,
  history,
  stream,
  missingConfig,
  t,
}: ChatHistoryOptions) {
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [historyScope, updateHistoryScope] =
    React.useState<ThreadHistoryScope>('all');
  const [historyProjectFilter, setHistoryProjectFilter] =
    React.useState<ThreadHistoryProject | null>(null);
  const setHistoryScope = (scope: ThreadHistoryScope) => {
    setHistoryProjectFilter(null);
    updateHistoryScope(scope);
  };

  React.useEffect(() => {
    setHistoryProjectFilter(null);
  }, [stream.client, stream.assistantId]);

  const [historyQuery, setHistoryQuery] = React.useState('');
  const effectiveHistoryScope =
    historyScope === 'current-project' && !activeProjectId
      ? 'all'
      : historyScope;

  const { threads, updateThread, deleteThread, refreshThreads } = useThreads(
    undefined,
    surface === 'main' && history?.enabled !== false,
  );

  const messageHistory = useMessageHistory({
    client: stream.client,
    assistantId: stream.assistantId,
    projectId: historyProjectFilter?.id ?? activeProjectId,
    enabled:
      historyOpen &&
      surface === 'main' &&
      history?.enabled !== false &&
      !missingConfig &&
      stream.isReady,
    query: historyQuery,
    scope: historyProjectFilter ? 'current-project' : effectiveHistoryScope,
  });

  const currentThread = React.useMemo(
    () =>
      threads.find((item) =>
        stream.conversationId
          ? item.recordId === stream.conversationId
          : item.id === stream.threadId,
      ),
    [threads, stream.threadId, stream.conversationId],
  );

  const assistantStatusText = React.useMemo(() => {
    if (!stream.threadId) return t('chat.statusOnline');
    return currentThread?.title?.trim() || t('chat.statusOnline');
  }, [currentThread?.title, stream.threadId, t]);
  return {
    refreshThreads,
    deleteThread,
    messageHistory,
    currentThread,
    assistantStatusText,
    updateThread,
    historyOpen,
    setHistoryOpen,
    historyQuery,
    setHistoryQuery,
    effectiveHistoryScope,
    setHistoryScope,
    historyProjectFilter,
    setHistoryProjectFilter,
  };
}
