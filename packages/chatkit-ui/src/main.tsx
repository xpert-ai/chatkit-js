import React from 'react';
import ReactDOM from 'react-dom/client';
import { NuqsAdapter } from "nuqs/adapters/react";
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import { decodeBase64 } from '@xpert-ai/chatkit-web-shared';

import App from './App';
import './index.css';
import { useParentMessenger } from './hooks/useParentMessenger';

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
  const [options, setOptions] = React.useState<ChatKitOptions | null>(initialOptions);
  const initialClientSecretRef = React.useRef(initialClientSecret);
  const parentOriginRef = React.useRef<string>('*');
  const { isParentAvailable, sendCommand } = useParentMessenger({
    onSetOptions: (nextOptions) => {
      setOptions(nextOptions);
    },
  });

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

      // const payload = event.data as {
      //   type?: string;
      //   clientSecret?: string;
      //   assistantId?: string;
      // };

      // Handle client secret from postMessage
      // if (payload.type === 'chatkit:init' || payload.type === 'chatkit:client-secret') {
      //   if (typeof payload.clientSecret === 'string') {
      //     setClientSecret(payload.clientSecret);
      //   }
      // }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  React.useEffect(() => {
    if (!isParentAvailable) return;

    parentOriginRef.current = getParentOrigin();
    const currentSecret = initialClientSecretRef.current.trim()
      ? initialClientSecretRef.current
      : null;

    let isActive = true;
    sendCommand("onGetClientSecret", currentSecret)
      .then((response) => {
        if (!isActive) return;
        if (typeof response === "string") {
          setClientSecret(response);
        }
      })
      .catch((error) => {
        if (!isActive) return;
        console.warn("[chatkit-ui] Failed to fetch client secret:", error);
      });

    return () => {
      isActive = false;
    };
  }, [isParentAvailable, sendCommand]);

  return <App clientSecret={clientSecret} options={options} />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NuqsAdapter>
      <AppContainer />
    </NuqsAdapter>
  </React.StrictMode>,
);
