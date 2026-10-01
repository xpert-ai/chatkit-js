import { useContext, useEffect, useState } from 'react';
import type { Assistant, Client } from '@xpert-ai/xpert-sdk';
import { ParentMessengerContext } from '../providers/ParentMessenger';

type AssistantClient = Pick<Client, 'assistants'>;

/** Scope the profile to the current client and Assistant, including pending requests. */
export function useAssistantInfo(
  client: AssistantClient | null | undefined,
  assistantId: string | null | undefined,
) {
  const messenger = useContext(ParentMessengerContext);
  const [revision, setRevision] = useState(0);
  const registerOnSetOptions = messenger?.registerOnSetOptions;
  useEffect(
    () => registerOnSetOptions?.(() => setRevision((value) => value + 1)),
    [registerOnSetOptions],
  );
  const [profile, setProfile] = useState<{
    client: AssistantClient;
    id: string;
    assistant: Assistant;
  } | null>(null);

  useEffect(() => {
    if (!client || !assistantId) {
      setProfile(null);
      return;
    }
    // Host updates revalidate published defaults without flashing the transcript or clearing local chat state.
    let cancelled = false;
    client.assistants.get(assistantId).then(
      (assistant) => {
        if (!cancelled && assistant)
          setProfile({ client, id: assistantId, assistant });
      },
      (error) => {
        if (!cancelled)
          console.warn('[ChatKit] Failed to load assistant info:', error);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [client, assistantId, revision]);

  return profile?.client === client && profile?.id === assistantId
    ? profile?.assistant
    : undefined;
}
