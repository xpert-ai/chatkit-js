import {
  combineRequestSignals,
  throwIfAborted,
  waitForCredentials,
} from '../../../lib/request-abort';
import { normalizeRequestLanguage } from '@xpert-ai/chatkit-types';
import { HTTPError } from '@xpert-ai/xpert-sdk';
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
  let refreshing: Promise<ResolvedClientSecret> | undefined;
  const refresh = () => {
    if (!refreshing) {
      const request = Promise.resolve()
        .then(refreshClientSecret)
        .finally(() => {
          if (refreshing === request) refreshing = undefined;
        });
      refreshing = request;
    }
    return refreshing;
  };
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
      sentCredential = await waitForCredentials(refresh(), signal);
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
        nextCredential = await waitForCredentials(refresh(), signal);
      } catch (refreshError) {
        throwIfAborted(signal);
        if (refreshError instanceof Error && refreshError.name === 'AbortError')
          throw refreshError;
        onRefreshError?.(refreshError);
        // The expired request did not execute. A temporary minting outage must
        // reach the read coordinator, rather than permanently blocking it as 401.
        const temporaryFailure = temporaryCredentialFailure(refreshError);
        if (temporaryFailure) throw temporaryFailure;
        return response;
      }
    }
    // Transport failures and cancellation are not credential-refresh failures.
    return requestWithSecret(nextCredential);
  };
}

class CredentialRefreshUnavailable extends HTTPError {
  override readonly retryAfterMs?: number;

  constructor(status: number, retryAfterMs?: number) {
    super(status, 'Session refresh temporarily unavailable.');
    this.retryAfterMs = retryAfterMs;
  }
}

function temporaryCredentialFailure(error: unknown) {
  if (!error || typeof error !== 'object' || !('status' in error)) return;
  const status = error.status;
  if (
    typeof status !== 'number' ||
    !(
      status === 0 ||
      status === 408 ||
      status === 429 ||
      (status >= 500 && status <= 599)
    )
  )
    return;
  const retryAfterMs =
    'retryAfterMs' in error &&
    typeof error.retryAfterMs === 'number' &&
    Number.isFinite(error.retryAfterMs)
      ? Math.max(0, error.retryAfterMs)
      : undefined;
  return new CredentialRefreshUnavailable(status, retryAfterMs);
}
