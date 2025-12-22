import React from 'react';
import ReactDOM from 'react-dom/client';
import { NuqsAdapter } from "nuqs/adapters/react";

import App from './App';
import './index.css';

const initialClientSecret =
  typeof window === 'undefined'
    ? ''
    : new URLSearchParams(window.location.search).get('clientSecret') ?? '';

const AppContainer = () => {
  const [clientSecret, setClientSecret] = React.useState(initialClientSecret);

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      if (!event.data || typeof event.data !== 'object') return;

      const payload = event.data as {
        type?: string;
        clientSecret?: string;
        styleConfig?: Record<string, unknown>;
      };

      // Support both old and new message formats
      if (payload.type === 'chatkit:init' || payload.type === 'chatkit:client-secret') {
        if (typeof payload.clientSecret === 'string') {
          setClientSecret(payload.clientSecret);
        }

        // TODO: Handle styleConfig when needed
        // if (payload.styleConfig) { ... }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return <App clientSecret={clientSecret} />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NuqsAdapter>
      <AppContainer />
    </NuqsAdapter>
  </React.StrictMode>,
);
