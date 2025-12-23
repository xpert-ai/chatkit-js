import React from 'react';
import ReactDOM from 'react-dom/client';
import { NuqsAdapter } from "nuqs/adapters/react";
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import { decodeBase64 } from '@xpert-ai/chatkit-web-shared';

import App from './App';
import './index.css';

type ChatKitMessage =
  | {
      type: "command";
      nonce: string;
      command: string;
      data: unknown;
    }
  | {
      type: "response";
      nonce: string;
      response?: unknown;
      error?: unknown;
    };

type ChatKitEnvelope = ChatKitMessage & { __oaiChatKit: true };

const getParentOrigin = () => {
  if (typeof document === 'undefined' || !document.referrer) return '*';
  try {
    return new URL(document.referrer).origin;
  } catch {
    return '*';
  }
};

const createNonce = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `ck_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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
    const params = decodeBase64<{ options: {options?: ChatKitOptions} }>(encoded);
    return params?.options?.options ?? null;
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
  const [options] = React.useState<ChatKitOptions | null>(initialOptions);
  const initialClientSecretRef = React.useRef(initialClientSecret);
  const pendingNonceRef = React.useRef<string | null>(null);
  const parentOriginRef = React.useRef<string>('*');

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

      const basePayload = event.data as {
        __oaiChatKit?: boolean;
        type?: string;
        nonce?: string;
        response?: unknown;
        error?: unknown;
        clientSecret?: string;
      };

      if (basePayload.__oaiChatKit === true) {
        const payload = event.data as ChatKitEnvelope;
        if (payload.type === "response" && payload.nonce === pendingNonceRef.current) {
          pendingNonceRef.current = null;
          if (payload.error) {
            console.warn('[chatkit-ui] Failed to fetch client secret:', payload.error);
            return;
          }
          if (typeof payload.response === "string") {
            setClientSecret(payload.response);
          }
        }
        return;
      }

      const payload = event.data as {
        type?: string;
        clientSecret?: string;
      };

      // Handle client secret from postMessage
      if (payload.type === 'chatkit:init' || payload.type === 'chatkit:client-secret') {
        if (typeof payload.clientSecret === 'string') {
          setClientSecret(payload.clientSecret);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return;

    parentOriginRef.current = getParentOrigin();
    const nonce = createNonce();
    pendingNonceRef.current = nonce;
    const message: ChatKitEnvelope = {
      __oaiChatKit: true,
      type: "command",
      nonce,
      command: "onGetClientSecret",
      data: initialClientSecretRef.current.trim()
        ? initialClientSecretRef.current
        : null,
    };

    window.parent.postMessage(message, parentOriginRef.current);
  }, []);

  return <App clientSecret={clientSecret} options={options} />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NuqsAdapter>
      <AppContainer />
    </NuqsAdapter>
  </React.StrictMode>,
);
