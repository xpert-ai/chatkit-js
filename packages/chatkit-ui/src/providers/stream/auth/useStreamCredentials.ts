import { Client } from '@xpert-ai/xpert-sdk';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { requestAborted } from '../../../lib/request-abort';
import { createMissingApiConfigurationError } from '../../../lib/api-config';
import {
  createSdkRequestHook,
  normalizeClientSecretResult,
  type ResolvedClientSecret,
} from '../../../lib/client-secret';
import type { useStreamHost } from '../host/useStreamHost';
import type { useStreamRunState } from '../runs/useStreamRunState';
import type { useStreamScope } from '../scope/useStreamScope';
import type { StateType } from '../types';
import {
  createFetchWithClientSecretRefresh,
  createLanguageHeaders,
} from './client-secret';

type StreamCredentialsOptions = Pick<
  ReturnType<typeof useStreamHost>,
  'isParentAvailable' | 'sendCommand'
> &
  Pick<ReturnType<typeof useStreamRunState>, 'lastEventIdRef'> &
  Pick<ReturnType<typeof useStreamScope>, 'clientRef'> & {
    apiKey: string;
    organizationId: string | undefined;
    getClientSecret:
      | (() => Promise<{ secret: string; organizationId?: string }>)
      | undefined;
    apiUrl: string;
    locale: string | null | undefined;
  };

export function useStreamCredentials({
  apiKey,
  organizationId,
  isParentAvailable,
  getClientSecret,
  sendCommand,
  apiUrl,
  locale,
  lastEventIdRef,
  clientRef,
}: StreamCredentialsOptions) {
  const [runtimeClientSecret, setRuntimeClientSecret] = useState(apiKey);
  const [runtimeOrganizationId, setRuntimeOrganizationId] = useState<
    string | undefined
  >(organizationId);

  const runtimeClientSecretRef = useRef(apiKey);
  const runtimeOrganizationIdRef = useRef<string | undefined>(organizationId);
  const refreshClientSecretPromiseRef =
    useRef<Promise<ResolvedClientSecret> | null>(null);

  const scopeController = useRef(new AbortController());
  useEffect(() => {
    // React StrictMode replays effects without discarding refs.
    if (scopeController.current.signal.aborted)
      scopeController.current = new AbortController();
    return () => {
      scopeController.current.abort(requestAborted());
      refreshClientSecretPromiseRef.current = null;
    };
  }, []);

  const getRuntimeOrganizationId = useCallback(
    () => runtimeOrganizationIdRef.current,
    [],
  );

  useEffect(() => {
    const nextOrganizationId = organizationId?.trim();
    runtimeClientSecretRef.current = apiKey;
    runtimeOrganizationIdRef.current = nextOrganizationId || undefined;
    setRuntimeClientSecret(apiKey);
    setRuntimeOrganizationId(nextOrganizationId || undefined);
  }, [apiKey, organizationId]);

  const refreshClientSecret =
    useCallback(async (): Promise<ResolvedClientSecret> => {
      const signal = scopeController.current.signal;
      if (signal.aborted) throw requestAborted();
      if (!isParentAvailable && !getClientSecret) {
        throw new Error(
          '[chatkit-ui] Parent window is not available for client secret refresh.',
        );
      }
      if (refreshClientSecretPromiseRef.current) {
        return refreshClientSecretPromiseRef.current;
      }

      const refreshPromise = (async () => {
        const currentSecret = runtimeClientSecretRef.current.trim();
        const response = getClientSecret
          ? await getClientSecret()
          : await sendCommand('onGetClientSecret', currentSecret || null);
        if (signal.aborted) throw requestAborted();
        const nextClientSecret = normalizeClientSecretResult(
          response,
          runtimeOrganizationIdRef.current,
        );

        runtimeClientSecretRef.current = nextClientSecret.secret;
        runtimeOrganizationIdRef.current = nextClientSecret.organizationId;
        setRuntimeClientSecret(nextClientSecret.secret);
        setRuntimeOrganizationId(nextClientSecret.organizationId);
        return nextClientSecret;
      })();

      refreshClientSecretPromiseRef.current = refreshPromise;
      try {
        return await refreshPromise;
      } finally {
        if (refreshClientSecretPromiseRef.current === refreshPromise) {
          refreshClientSecretPromiseRef.current = null;
        }
      }
    }, [isParentAvailable, sendCommand, getClientSecret]);

  const ensureHistoryCredentials = useCallback(async () => {
    if (
      apiUrl.trim() &&
      !runtimeClientSecretRef.current.trim() &&
      (isParentAvailable || getClientSecret)
    ) {
      await refreshClientSecret();
    }
    // Host commands can retain a callback from before credentials were ready.
    const configError = createMissingApiConfigurationError({
      apiUrl,
      clientSecret: runtimeClientSecretRef.current,
    });
    if (configError) throw configError;
  }, [apiUrl, isParentAvailable, getClientSecret, refreshClientSecret]);

  const fetchWithClientSecretRefresh = useMemo(
    () =>
      createFetchWithClientSecretRefresh({
        getCurrentClientSecret: () => {
          const currentSecret = runtimeClientSecretRef.current.trim();
          const currentOrganizationId =
            runtimeOrganizationIdRef.current?.trim();

          return currentOrganizationId
            ? { secret: currentSecret, organizationId: currentOrganizationId }
            : { secret: currentSecret };
        },
        refreshClientSecret,
        getScopeSignal: () => scopeController.current.signal,
        onRefreshError: (refreshError) => {
          console.warn(
            '[chatkit-ui] Failed to refresh client secret:',
            refreshError,
          );
        },
      }),
    [refreshClientSecret],
  );

  const client = useMemo(
    () =>
      new Client<StateType>({
        apiUrl,
        defaultHeaders: createLanguageHeaders(locale),
        callerOptions: {
          fetch: fetchWithClientSecretRefresh,
        },
        onRequest: createSdkRequestHook(
          () => ({
            secret: runtimeClientSecretRef.current.trim(),
            organizationId:
              runtimeOrganizationIdRef.current?.trim() || undefined,
          }),
          // Run cursors belong to each transport, never to unrelated thread subscriptions.
          () => null,
        ),
      }),
    [apiUrl, fetchWithClientSecretRefresh, locale],
  );

  clientRef.current = client;
  return {
    client,
    runtimeClientSecret,
    runtimeOrganizationId,
    getRuntimeOrganizationId,
    ensureHistoryCredentials,
    runtimeClientSecretRef,
    fetchWithClientSecretRefresh,
    refreshClientSecret,
  };
}
