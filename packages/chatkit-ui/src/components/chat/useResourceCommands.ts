import * as React from 'react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type {
  Client,
  RuntimeResourceCommand,
  RuntimeResourcesSelection,
} from '@xpert-ai/xpert-sdk';

const commandsCache = new WeakMap<
  Client<unknown>,
  Map<string, { commands: RuntimeResourceCommand[]; expires: number }>
>();

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
  const key = JSON.stringify([
    assistantId,
    projectId ?? null,
    selection.resources,
  ]);
  const selectionRef = React.useRef(selection);
  selectionRef.current = selection;
  const [result, setResult] = React.useState<{
    client: Client<unknown>;
    key: string;
    commands: RuntimeResourceCommand[];
    error?: string;
  }>();
  React.useEffect(() => {
    if (!enabled || !client || !assistantId || !selection.resources.length)
      return;
    if (typeof client.assistants.getResourceCommands !== 'function') {
      setResult({ client, key, commands: [], error: unavailable });
      return;
    }
    const cache = commandsCache.get(client) ?? new Map();
    commandsCache.set(client, cache);
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) {
      setResult({ client, key, commands: cached.commands });
      return;
    }
    const controller = new AbortController();
    client.assistants
      .getResourceCommands(assistantId, selectionRef.current, {
        projectId: projectId ?? undefined,
        signal: controller.signal,
      })
      .then((commands) => {
        if (!controller.signal.aborted) {
          if (cache.size >= 32) cache.delete(cache.keys().next().value!);
          cache.set(key, { commands, expires: Date.now() + 60_000 });
          setResult({ client, key, commands });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            client,
            key,
            commands: [],
            error: error instanceof Error ? error.message : String(error),
          });
      });
    return () => controller.abort();
  }, [client, assistantId, projectId, enabled, key, unavailable]);
  return enabled && result?.client === client && result?.key === key
    ? { key: result.key, commands: result.commands, error: result.error }
    : { commands: [], error: undefined };
}
