import { useEffect, useRef, useState } from 'react';
import type {
  ChatGroupComposerInput,
  ChatGroupProject,
  ChatGroupSendInput,
} from '@xpert-ai/xpert-sdk';

/** Resume only the send that opened Project setup, after its new scope is ready. */
export function useGroupProjectContinuation({
  groupId,
  draftKey,
  composer,
  blocked,
  sending,
  onSend,
}: {
  groupId: string;
  draftKey: string;
  composer: ChatGroupComposerInput | undefined;
  blocked: boolean;
  sending: boolean;
  onSend: (input: ChatGroupSendInput) => Promise<void>;
}) {
  const pending = useRef<{
    groupId: string;
    draftKey: string;
    input: ChatGroupSendInput;
    projectId?: string;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const attempt = pending.current;
    if (!attempt) return;
    if (attempt.groupId !== groupId || attempt.draftKey !== draftKey) {
      pending.current = null;
      return;
    }
    if (!attempt.projectId || blocked || sending) return;
    if (
      attempt.input.composer &&
      (composer?.participantId !== attempt.input.composer.participantId ||
        composer.projectId !== attempt.projectId)
    )
      return;
    // Consume before sending so rerenders cannot submit the same continuation twice.
    pending.current = null;
    void onSend({
      ...attempt.input,
      ...(attempt.input.composer
        ? {
            composer: {
              ...attempt.input.composer,
              projectId: attempt.projectId,
            },
          }
        : {}),
    });
  }, [groupId, draftKey, composer, blocked, sending, onSend, revision]);
  return {
    remember: (input: ChatGroupSendInput) => {
      pending.current = { groupId, draftKey, input };
    },
    ready: (project: ChatGroupProject) => {
      if (pending.current?.groupId !== groupId) return;
      pending.current.projectId = project.projectId;
      setRevision((value) => value + 1);
    },
    cancel: () => {
      pending.current = null;
    },
  };
}
