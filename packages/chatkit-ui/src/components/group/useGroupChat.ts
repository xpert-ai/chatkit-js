import {
  normalizeClientSecretResult,
  createSdkRequestHook,
  type ResolvedClientSecret,
} from '../../lib/client-secret';
import { createFetchWithClientSecretRefresh } from '../../providers/stream/auth/client-secret';
import { throwIfAborted } from '../../lib/request-abort';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Client, type ChatGroupSendInput } from '@xpert-ai/xpert-sdk';
import type { ChatProps } from '../chat/types';
import type { StateType } from '../../providers/stream/types';
import {
  applyGroupEvent,
  initialGroupState,
  mergeGroupMessages,
} from './group-state';

export function useGroupChat({
  groupId,
  clientSecret = '',
  options,
  refreshClientSecret,
}: ChatProps & { groupId: string }) {
  const [state, setState] = useState(initialGroupState);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  // Each audience owns its credential and abort scope. A late refresh from the
  // previous conversation cannot change the active conversation's credentials.
  const scope = useMemo(
    () => ({
      credential: { secret: clientSecret } as ResolvedClientSecret,
      controller: new AbortController(),
      refresh: refreshClientSecret,
      getSecret:
        options?.api && 'getClientSecret' in options.api
          ? options.api.getClientSecret
          : undefined,
    }),
    [groupId, options?.api.apiUrl],
  );
  scope.refresh = refreshClientSecret;
  scope.getSecret =
    options?.api && 'getClientSecret' in options.api
      ? options.api.getClientSecret
      : undefined;
  useEffect(() => {
    scope.credential = { ...scope.credential, secret: clientSecret };
  }, [scope, clientSecret]);
  const client = useMemo(
    () =>
      new Client<StateType>({
        apiUrl: options?.api.apiUrl,
        callerOptions: {
          maxRetries: 0,
          fetch: createFetchWithClientSecretRefresh({
            getCurrentClientSecret: () => scope.credential,
            getScopeSignal: () => scope.controller.signal,
            refreshClientSecret: async () => {
              const signal = scope.controller.signal;
              throwIfAborted(signal);
              const result = scope.refresh
                ? await scope.refresh()
                : scope.getSecret
                  ? await scope.getSecret(scope.credential.secret || null)
                  : undefined;
              throwIfAborted(signal);
              scope.credential = normalizeClientSecretResult(
                result,
                scope.credential.organizationId,
              );
              return scope.credential;
            },
          }),
        },
        onRequest: createSdkRequestHook(() => scope.credential),
      }),
    [scope, options?.api.apiUrl],
  );
  useEffect(() => {
    const controller = new AbortController();
    scope.controller = controller;
    let cursor: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const connect = async () => {
      try {
        for await (const event of client.groups.stream(groupId, {
          signal: controller.signal,
          lastEventId: cursor,
        })) {
          if (controller.signal.aborted) return;
          cursor = event.id ?? cursor;
          setConnected(true);
          setError(null);
          failures = 0;
          setState((previous) => applyGroupEvent(previous, event.data));
        }
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : String(reason));
        const status =
          reason && typeof reason === 'object' && 'status' in reason
            ? reason.status
            : undefined;
        // The shared transport already retried a 401 once. Authorization failures
        // must stop here instead of repeatedly asking the host for new credentials.
        if (status === 401 || status === 403) {
          setConnected(false);
          return;
        }
      }
      if (!controller.signal.aborted) {
        setConnected(false);
        timer = setTimeout(
          () => void connect(),
          Math.min(30000, 1000 * 2 ** Math.min(failures++, 5)),
        );
      }
    };
    void connect();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [client, groupId, scope]);
  const send = useCallback(
    async (input: ChatGroupSendInput) => {
      const message = await client.groups.send(groupId, input);
      setState((previous) =>
        previous.snapshot
          ? {
              ...previous,
              snapshot: {
                ...previous.snapshot,
                messages: mergeGroupMessages(previous.snapshot.messages, [
                  message,
                ]),
              },
            }
          : previous,
      );
    },
    [client, groupId],
  );
  const loadMore = useCallback(async () => {
    if (!state.snapshot?.hasMore) return [];
    const page = await client.groups.get(groupId, {
      before: state.snapshot.messages[0]?.sequence,
    });
    setState((previous) =>
      previous.snapshot
        ? {
            ...previous,
            snapshot: {
              ...previous.snapshot,
              messages: mergeGroupMessages(
                page.messages,
                previous.snapshot.messages,
              ),
              hasMore: page.hasMore,
            },
          }
        : previous,
    );
    return page.messages;
  }, [client, groupId, state.snapshot]);
  return { state, connected, error, setError, client, send, loadMore };
}
