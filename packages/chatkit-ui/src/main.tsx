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
      const payload = event.data as { type?: string; clientSecret?: string };
      if (payload.type !== 'chatkit:client-secret') return;
      if (typeof payload.clientSecret !== 'string') return;
      setClientSecret(payload.clientSecret);
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
