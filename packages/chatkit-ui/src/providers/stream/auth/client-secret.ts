import {
  combineRequestSignals,
  throwIfAborted,
  waitForCredentials,
} from '../../../lib/request-abort';
import { normalizeRequestLanguage } from '@xpert-ai/chatkit-types';
import {
  withClientSecretHeaders,
  type ResolvedClientSecret,
} from '../../../lib/client-secret';

export function createLanguageHeaders(
  locale?: string | null,
): Record<string, string> | undefined {
  const language = normalizeRequestLanguage(locale);
  return language
    ? {
        Language: language,
        'Accept-Language': language,
      }
    : undefined;
}

export type CreateFetchWithClientSecretRefreshOptions = {
  fetchFn?: typeof fetch;
  getCurrentClientSecret: () => ResolvedClientSecret;
  refreshClientSecret: () => Promise<ResolvedClientSecret>;
  getScopeSignal?: () => AbortSignal;
  onRefreshError?: (error: unknown) => void;
};

export function createFetchWithClientSecretRefresh({
  fetchFn = fetch,
  getCurrentClientSecret,
  refreshClientSecret,
  onRefreshError,
  getScopeSignal,
}: CreateFetchWithClientSecretRefreshOptions): typeof fetch {
  return async (input, init) => {
    const signal = combineRequestSignals([
      init?.signal ?? (input instanceof Request ? input.signal : undefined),
      getScopeSignal?.(),
    ]);
    const requestWithSecret = (clientSecret: ResolvedClientSecret) => {
      throwIfAborted(signal);
      return fetchFn(input, {
        ...init,
        signal,
        headers: withClientSecretHeaders(
          init?.headers ??
            (input instanceof Request ? input.headers : undefined),
          clientSecret,
        ),
      }).catch((error) => {
        throwIfAborted(signal);
        throw error;
      });
    };

    throwIfAborted(signal);
    let sentCredential = getCurrentClientSecret();
    if (!sentCredential.secret.trim()) {
      sentCredential = await waitForCredentials(refreshClientSecret(), signal);
    }
    const response = await requestWithSecret(sentCredential);
    if (response.status !== 401) return response;

    throwIfAborted(signal);
    // Another request may have refreshed while this response was in flight.
    let nextCredential = getCurrentClientSecret();
    if (
      !nextCredential.secret.trim() ||
      nextCredential.secret === sentCredential.secret
    ) {
      try {
        nextCredential = await waitForCredentials(
          refreshClientSecret(),
          signal,
        );
      } catch (refreshError) {
        throwIfAborted(signal);
        if (refreshError instanceof Error && refreshError.name === 'AbortError')
          throw refreshError;
        onRefreshError?.(refreshError);
        return response;
      }
    }
    // Transport failures and cancellation are not credential-refresh failures.
    return requestWithSecret(nextCredential);
  };
}
