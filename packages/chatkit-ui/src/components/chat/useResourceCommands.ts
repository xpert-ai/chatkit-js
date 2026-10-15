import * as React from 'react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type {
  Client,
  RuntimeResourceCommand,
  RuntimeResourcesSelection,
} from '@xpert-ai/xpert-sdk';

export function useResourceCommands({
  client,
  assistantId,
  projectId,
  selection,
  enabled,
}: {
  client: Client<unknown> | null;
  assistantId?: string | null;
  projectId?: string | null;
  selection: RuntimeResourcesSelection;
  enabled: boolean;
}) {
  const { t } = useChatkitTranslation();
  const unavailable = t('composer.resources.commandsUnavailable');
  const key = JSON.stringify([assistantId, projectId, enabled, selection]);
  const [result, setResult] = React.useState<{
    key: string;
    commands: RuntimeResourceCommand[];
    error?: string;
  }>();
  React.useEffect(() => {
    if (!enabled || !client || !assistantId || !selection.resources.length)
      return;
    if (typeof client.assistants.getResourceCommands !== 'function') {
      setResult({ key, commands: [], error: unavailable });
      return;
    }
    const controller = new AbortController();
    client.assistants
      .getResourceCommands(assistantId, selection, {
        projectId: projectId ?? undefined,
        signal: controller.signal,
      })
      .then((commands) => {
        if (!controller.signal.aborted) setResult({ key, commands });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            commands: [],
            error: error instanceof Error ? error.message : String(error),
          });
      });
    return () => controller.abort();
  }, [client, assistantId, projectId, enabled, key, selection, unavailable]);
  return result?.key === key ? result : { commands: [], error: undefined };
}
