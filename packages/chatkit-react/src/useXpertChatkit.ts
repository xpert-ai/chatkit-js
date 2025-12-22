import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  UseXpertChatkitOptions,
  UseXpertChatkitReturn,
  ChatkitControl,
  ChatkitStatus,
} from './types';

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
 *   onError: (error) => console.error('Failed to get secret:', error),
 * });
 *
 * return <XpertChatkit control={control} className="h-full" />;
 * ```
 */
export function useXpertChatkit(options: UseXpertChatkitOptions): UseXpertChatkitReturn {
  const { getClientSecret, chatkitUrl, styleConfig, onError, onSecretReady } = options;

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
    styleConfig,
    refreshSecret: fetchSecret,
  };

  return { control };
}
