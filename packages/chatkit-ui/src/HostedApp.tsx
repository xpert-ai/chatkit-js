import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import App from './App';
import { useHostCredentials } from './hooks/useHostCredentials';
import type { ParentMessenger } from './providers/ParentMessenger';

/** Reset conversation UI on host navigation, while retaining the iframe/module graph. */
export function HostedApp({
  options,
  parent,
  initialClientSecret,
}: {
  options: ChatKitOptions | null;
  parent: Pick<ParentMessenger, 'isParentAvailable' | 'sendCommand'>;
  initialClientSecret: string;
}) {
  const credentials = useHostCredentials({
    initialClientSecret,
    apiUrl: options?.api.apiUrl,
    assistantId: options?.api.xpertId,
    groupId: options?.group?.id,
    sessionKey: options?.sessionKey,
    isParentAvailable: parent.isParentAvailable,
    sendCommand: parent.sendCommand,
  });
  const binding = JSON.stringify([
    options?.api.apiUrl,
    options?.api.xpertId,
    options?.group?.id,
    options?.sessionKey,
  ]);
  return <App key={binding} options={options} {...credentials} />;
}
