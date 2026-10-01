import * as React from 'react';
import { useThreadBranches } from '../../../hooks/useThreadBranches';
import type { useChatEnvironment } from './useChatEnvironment';

type ChatBranchStateOptions = Pick<
  ReturnType<typeof useChatEnvironment>,
  'stream'
>;

export function useChatBranchState({ stream }: ChatBranchStateOptions) {
  const branchState = useThreadBranches(
    stream.client,
    stream.conversationId,
    stream.threadId,
    Boolean(stream.isReady && stream.client?.conversations?.listThreads),
    stream.isLoading,
  );

  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(
    null,
  );

  const editRequestRef = React.useRef<{
    messageId: string;
    requestId: string;
  } | null>(null);

  const [isChangingBranch, setIsChangingBranch] = React.useState(false);
  const activeBranchRef = React.useRef(stream.threadId);

  activeBranchRef.current = stream.threadId;

  React.useEffect(() => {
    setEditingMessageId(null);
    editRequestRef.current = null;
  }, [stream.threadId]);
  return {
    branchState,
    activeBranchRef,
    setEditingMessageId,
    isChangingBranch,
    editRequestRef,
    setIsChangingBranch,
    editingMessageId,
  };
}
