import * as React from 'react';
import { useMessageHistory } from '../../../hooks/useMessageHistory';
import { useThreads, type ThreadHistoryScope } from '../../../hooks/useThreads';
import type { useChatEnvironment } from '../session/useChatEnvironment';

type ChatHistoryOptions = Pick<
  ReturnType<typeof useChatEnvironment>,
  'activeProjectId' | 'history' | 'stream' | 'missingConfig' | 't'
> & {
  surface: 'main' | 'side';
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
  const [historyScope, setHistoryScope] =
    React.useState<ThreadHistoryScope>('all');

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
    projectId: activeProjectId,
    enabled:
      historyOpen &&
      surface === 'main' &&
      history?.enabled !== false &&
      !missingConfig &&
      stream.isReady,
    query: historyQuery,
    scope: effectiveHistoryScope,
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
  };
}
