import { createContext, useContext, useEffect, useState } from 'react';
import type { Assistant, Client } from '@xpert-ai/xpert-sdk';
import { ParentMessengerContext } from '../providers/ParentMessenger';

type AssistantClient = Pick<Client, 'assistants'>;

export const AssistantInfoContext = createContext<{
  client: AssistantClient | null;
  id: string;
  assistant: Assistant | undefined;
} | null>(null);

/** Reuse the session's profile across project/chat remounts, with a standalone fallback. */
export function useAssistantInfo(
  client: AssistantClient | null | undefined,
  assistantId: string | null | undefined,
) {
  const shared = useContext(AssistantInfoContext);
  const matchesSession =
    shared !== null && shared.client === client && shared.id === assistantId;
  const local = useAssistantProfile(
    matchesSession ? null : client,
    assistantId,
  );
  return matchesSession ? shared.assistant : local;
}

/** Scope the profile to the current client and Assistant, including pending requests. */
function useAssistantProfile(
  client: AssistantClient | null | undefined,
  assistantId: string | null | undefined,
) {
  const messenger = useContext(ParentMessengerContext);
  const [revision, setRevision] = useState(0);
  const registerOnSetOptions = messenger?.registerOnSetOptions;
  useEffect(() => {
    if (!client || !assistantId) return;
    return registerOnSetOptions?.(() => setRevision((value) => value + 1));
  }, [client, assistantId, registerOnSetOptions]);
  useEffect(() => {
    if (!client || !assistantId) return;
    const refresh = () => {
      if (document.visibilityState === 'visible')
        setRevision((value) => value + 1);
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(timer);
    };
  }, [client, assistantId]);
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
