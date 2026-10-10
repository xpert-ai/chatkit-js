import { useMemo, type ReactNode } from 'react';
import {
  AssistantInfoContext,
  useAssistantInfo,
} from '../hooks/useAssistantInfo';
import { getMissingApiConfigurationKind } from '../lib/api-config';
import { useStreamContext } from './Stream';

/** Own Assistant identity outside the project-keyed Chat subtree. */
export function AssistantInfoProvider({ children }: { children: ReactNode }) {
  const stream = useStreamContext();
  const client = getMissingApiConfigurationKind({
    apiUrl: stream.apiUrl,
    clientSecret: stream.apiKey,
  })
    ? null
    : stream.client;
  const id = stream.assistantId;
  const assistant = useAssistantInfo(client, id);
  const value = useMemo(
    () => ({ client, id, assistant }),
    [client, id, assistant],
  );

  return (
    <AssistantInfoContext.Provider value={value}>
      {children}
    </AssistantInfoContext.Provider>
  );
}
