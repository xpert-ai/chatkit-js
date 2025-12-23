import React from 'react';
import ReactDOM from 'react-dom/client';
import { NuqsAdapter } from "nuqs/adapters/react";
import type { XpertChatkitOptions } from '@xpert-ai/chatkit-types';

import App from './App';
import './index.css';

/**
 * Decode base64 options from URL parameter
 */
function decodeOptionsFromUrl(): XpertChatkitOptions | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const encoded = params.get('options');

  if (!encoded) return null;

  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    return JSON.parse(json) as XpertChatkitOptions;
  } catch (error) {
    console.warn('[chatkit-ui] Failed to decode options from URL:', error);
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
  const [options] = React.useState<XpertChatkitOptions | null>(initialOptions);

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      if (!event.data || typeof event.data !== 'object') return;

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

  return <App clientSecret={clientSecret} options={options} />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NuqsAdapter>
      <AppContainer />
    </NuqsAdapter>
  </React.StrictMode>,
);
