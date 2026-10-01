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
  onRefreshError?: (error: unknown) => void;
};

export function createFetchWithClientSecretRefresh({
  fetchFn = fetch,
  getCurrentClientSecret,
  refreshClientSecret,
  onRefreshError,
}: CreateFetchWithClientSecretRefreshOptions): typeof fetch {
  return async (input, init) => {
    const requestWithSecret = (clientSecret: ResolvedClientSecret) => {
      return fetchFn(input, {
        ...init,
        headers: withClientSecretHeaders(init?.headers, clientSecret),
      });
    };

    const response = await requestWithSecret(getCurrentClientSecret());
    if (response.status !== 401) {
      return response;
    }

    try {
      const refreshedClientSecret = await refreshClientSecret();
      return await requestWithSecret(refreshedClientSecret);
    } catch (refreshError) {
      onRefreshError?.(refreshError);
      return response;
    }
  };
}
