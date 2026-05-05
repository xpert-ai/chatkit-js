import React from 'react';
import ReactDOM from 'react-dom/client';
import { NuqsAdapter } from "nuqs/adapters/react";
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import { decodeBase64 } from '@xpert-ai/chatkit-web-shared';

import App from './App';
import './index.css';
import { ParentMessengerProvider } from './providers/ParentMessenger';
import { useParentMessenger } from './hooks/useParentMessenger';
import { normalizeClientSecretResult } from './lib/client-secret';

const getParentOrigin = () => {
  if (typeof document === 'undefined' || !document.referrer) return '*';
  try {
    return new URL(document.referrer).origin;
  } catch {
    return '*';
  }
};

/**
 * Decode base64 options from URL hash
 */
function decodeOptionsFromUrl(): ChatKitOptions | null {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash;
  const encoded = hash.startsWith('#') ? hash.slice(1) : hash;

  if (!encoded) return null;

  try {
    const params = decodeBase64<{ options?: ChatKitOptions }>(encoded);
    return params?.options ?? null;
  } catch (error) {
    console.warn('[chatkit-ui] Failed to decode options from URL hash:', error);
    return null;
  }
}

const initialClientSecret =
  typeof window === 'undefined'
    ? ''
    : new URLSearchParams(window.location.search).get('clientSecret') ?? '';

// Parse options from URL on initial load
const initialOptions = decodeOptionsFromUrl();

const AppContainer = () => {
  const [clientSecret, setClientSecret] = React.useState(initialClientSecret);
  const [organizationId, setOrganizationId] = React.useState<string | undefined>();
  const [resolvedXpertId, setResolvedXpertId] = React.useState<string | undefined>();
  const [options, setOptions] = React.useState<ChatKitOptions | null>(initialOptions);
  const [isClientSecretInitializing, setIsClientSecretInitializing] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    const hasInitialSecret = Boolean(initialClientSecret.trim());
    const isInsideIframe = window.parent !== window;
    return isInsideIframe && !hasInitialSecret;
  });
  const initialClientSecretRef = React.useRef(initialClientSecret);
  const organizationIdRef = React.useRef<string | undefined>(undefined);
  const parentOriginRef = React.useRef<string>('*');
  const { isParentAvailable, sendCommand } = useParentMessenger({
    onSetOptions: (nextOptions) => {
      setOptions(nextOptions);
    },
  });

  React.useEffect(() => {
    organizationIdRef.current = organizationId;
  }, [organizationId]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      if (!event.data || typeof event.data !== 'object') return;
      if (
        parentOriginRef.current !== '*' &&
        typeof event.origin === 'string' &&
        event.origin !== parentOriginRef.current
      ) {
        return;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  React.useEffect(() => {
    const needsInitialSecret = !initialClientSecretRef.current.trim();
    if (!isParentAvailable) {
      if (needsInitialSecret) {
        setIsClientSecretInitializing(false);
      }
      return;
    }

    parentOriginRef.current = getParentOrigin();
    const currentSecret = initialClientSecretRef.current.trim()
      ? initialClientSecretRef.current
      : null;
    if (needsInitialSecret) {
      setIsClientSecretInitializing(true);
    }

    let isActive = true;
    sendCommand("onGetClientSecret", currentSecret)
      .then((response) => {
        if (!isActive) return;
        const resolved = normalizeClientSecretResult(
          response,
          organizationIdRef.current,
        );
        setClientSecret(resolved.secret);
        setOrganizationId(resolved.organizationId);
        setResolvedXpertId((current) => resolved.xpertId ?? resolved.assistantId ?? current);
      })
      .catch((error) => {
        if (!isActive) return;
        console.warn("[chatkit-ui] Failed to fetch client secret:", error);
      })
      .finally(() => {
        if (!isActive) return;
        if (needsInitialSecret) {
          setIsClientSecretInitializing(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [isParentAvailable, sendCommand]);

  return (
    <App
      clientSecret={clientSecret}
      organizationId={organizationId}
      resolvedXpertId={resolvedXpertId}
      options={options}
      isClientSecretInitializing={isClientSecretInitializing}
    />
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NuqsAdapter>
      <ParentMessengerProvider>
        <AppContainer />
      </ParentMessengerProvider>
    </NuqsAdapter>
  </React.StrictMode>,
);
