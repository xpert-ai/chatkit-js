import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  normalizeClientSecretResult,
  type ResolvedClientSecret,
} from '../lib/client-secret';
import { requestAborted } from '../lib/request-abort';
import type { ParentMessenger } from '../providers/ParentMessenger';

type CredentialScope = {
  value: ResolvedClientSecret | null;
  resolvedXpertId?: string;
  pending: Promise<ResolvedClientSecret> | null;
  active: boolean;
  generation: number;
  finished: boolean;
};

/** Share bootstrap and refresh, without carrying credentials into another host binding. */
export function useHostCredentials({
  initialClientSecret,
  apiUrl,
  assistantId,
  groupId,
  sessionKey,
  isParentAvailable,
  sendCommand,
}: Pick<ParentMessenger, 'isParentAvailable' | 'sendCommand'> & {
  initialClientSecret: string;
  apiUrl?: string;
  assistantId?: string;
  groupId?: string;
  sessionKey?: string;
}) {
  const binding = JSON.stringify([apiUrl, assistantId, groupId, sessionKey]);
  const initialBinding = useRef(binding);
  const [, render] = useReducer((revision: number) => revision + 1, 0);
  const scope = useMemo<CredentialScope>(
    () => ({
      value:
        initialBinding.current === binding && initialClientSecret.trim()
          ? { secret: initialClientSecret }
          : null,
      pending: null,
      active: true,
      generation: 0,
      finished: !isParentAvailable,
    }),
    [binding, initialClientSecret, isParentAvailable, sendCommand],
  );

  const refresh = useCallback((): Promise<ResolvedClientSecret> => {
    if (!scope.active) return Promise.reject(requestAborted());
    if (scope.pending) return scope.pending;
    const generation = scope.generation;
    const request = sendCommand(
      'onGetClientSecret',
      scope.value?.secret ?? null,
    )
      .then((result) => {
        if (!scope.active || scope.generation !== generation)
          throw requestAborted();
        scope.value = normalizeClientSecretResult(
          result,
          scope.value?.organizationId,
        );
        scope.resolvedXpertId =
          scope.value.xpertId ??
          scope.value.assistantId ??
          scope.resolvedXpertId;
        scope.finished = true;
        render();
        return scope.value;
      })
      .finally(() => {
        if (scope.pending === request) scope.pending = null;
      });
    scope.pending = request;
    return request;
  }, [scope, sendCommand]);

  useEffect(() => {
    scope.active = true;
    const generation = scope.generation;
    if (isParentAvailable) {
      void refresh().catch((error) => {
        if (!scope.active || scope.generation !== generation) return;
        scope.finished = true;
        render();
        if (!(error instanceof Error && error.name === 'AbortError')) {
          console.warn('[chatkit-ui] Failed to fetch client secret:', error);
        }
      });
    }
    return () => {
      scope.active = false;
      scope.generation += 1;
      scope.pending = null;
    };
  }, [scope, isParentAvailable, refresh]);

  return {
    clientSecret: scope.value?.secret ?? '',
    organizationId: scope.value?.organizationId,
    resolvedXpertId: scope.resolvedXpertId,
    isClientSecretInitializing:
      isParentAvailable && !scope.value && !scope.finished,
    getClientSecret: isParentAvailable ? refresh : undefined,
  };
}
