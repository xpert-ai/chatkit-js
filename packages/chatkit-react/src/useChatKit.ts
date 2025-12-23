import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type {
  UseChatKitOptions,
  UseChatKitReturn,
  ChatKitControl,
  ChatKitStatus,
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
function buildChatKitUrl(baseUrl: string, options?: Record<string, unknown>): string {
  if (!options || Object.keys(options).length === 0) {
    return baseUrl;
  }

  const encoded = encodeOptionsToBase64(options);
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}options=${encoded}`;
}

/**
 * Hook for managing Xpert ChatKit state and authentication
 *
 * @example
 * ```tsx
 * const { control } = useChatKit({
 *   chatkitUrl: 'https://chatkit.example.com',
 *   api: {
 *     getClientSecret: async () => {
 *       const res = await fetch('/api/create-session', { method: 'POST' });
 *       const data = await res.json();
 *       return data.client_secret;
 *     }
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
 * return <XpertChatKit control={control} className="h-full" />;
 * ```
 */
export function useChatKit(hookOptions: UseChatKitOptions): UseChatKitReturn {
  const { api, chatkitUrl: baseChatKitUrl, options, onError, onSecretReady } = hookOptions;

  const [status, setStatus] = useState<ChatKitStatus>('idle');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Keep refs for callbacks to avoid stale closures
  const getClientSecretRef = useRef(api.getClientSecret);
  const onErrorRef = useRef(onError);
  const onSecretReadyRef = useRef(onSecretReady);

  // Update refs on each render
  getClientSecretRef.current = api.getClientSecret;
  onErrorRef.current = onError;
  onSecretReadyRef.current = onSecretReady;

  // Build full URL with options encoded
  const chatkitUrl = useMemo(() => {
    return buildChatKitUrl(baseChatKitUrl, options);
  }, [baseChatKitUrl, options]);

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
  }, []);

  const control: ChatKitControl = {
    status,
    clientSecret,
    error,
    chatkitUrl,
    refreshSecret: fetchSecret,
  };

  return { control };
}
