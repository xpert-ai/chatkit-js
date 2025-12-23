import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type {
  UseXpertChatkitOptions,
  UseXpertChatkitReturn,
  ChatkitControl,
  ChatkitStatus,
} from './types';

/**
 * Encode options to base64 for URL
 */
function encodeOptionsToBase64(options: Record<string, unknown>): string {
  const json = JSON.stringify(options);
  // Use btoa for browser, handle unicode characters
  const encoded = btoa(unescape(encodeURIComponent(json)));
  return encoded;
}

/**
 * Build the full chatkit URL with options encoded
 */
function buildChatkitUrl(baseUrl: string, options?: Record<string, unknown>): string {
  if (!options || Object.keys(options).length === 0) {
    return baseUrl;
  }

  const encoded = encodeOptionsToBase64(options);
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}options=${encoded}`;
}

/**
 * Hook for managing Xpert Chatkit state and authentication
 *
 * @example
 * ```tsx
 * const { control } = useXpertChatkit({
 *   chatkitUrl: 'https://chatkit.example.com',
 *   getClientSecret: async () => {
 *     const res = await fetch('/api/create-session', { method: 'POST' });
 *     const data = await res.json();
 *     return data.client_secret;
 *   },
 *   options: {
 *     theme: {
 *       colorScheme: 'dark',
 *       radius: 'round',
 *     },
 *     startScreen: {
 *       greeting: 'Hello! How can I help you?',
 *     },
 *   },
 *   onError: (error) => console.error('Failed to get secret:', error),
 * });
 *
 * return <XpertChatkit control={control} className="h-full" />;
 * ```
 */
export function useXpertChatkit(hookOptions: UseXpertChatkitOptions): UseXpertChatkitReturn {
  const { getClientSecret, chatkitUrl: baseChatkitUrl, options, onError, onSecretReady } = hookOptions;

  const [status, setStatus] = useState<ChatkitStatus>('idle');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Keep refs for callbacks to avoid stale closures
  const getClientSecretRef = useRef(getClientSecret);
  const onErrorRef = useRef(onError);
  const onSecretReadyRef = useRef(onSecretReady);

  // Update refs on each render
  getClientSecretRef.current = getClientSecret;
  onErrorRef.current = onError;
  onSecretReadyRef.current = onSecretReady;

  // Build full URL with options encoded
  const chatkitUrl = useMemo(() => {
    return buildChatkitUrl(baseChatkitUrl, options);
  }, [baseChatkitUrl, options]);

  const fetchSecret = useCallback(async () => {
    setStatus('loading');
    setError(null);

    try {
      const secret = await getClientSecretRef.current(clientSecret);
      setClientSecret(secret);
      setStatus('ready');
      onSecretReadyRef.current?.(secret);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setStatus('error');
      onErrorRef.current?.(error);
    }
  }, [clientSecret]);

  // Fetch secret on mount
  useEffect(() => {
    fetchSecret();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const control: ChatkitControl = {
    status,
    clientSecret,
    error,
    chatkitUrl,
    refreshSecret: fetchSecret,
  };

  return { control };
}
