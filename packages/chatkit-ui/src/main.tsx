import React from 'react';
import ReactDOM from 'react-dom/client';
import { NuqsAdapter } from 'nuqs/adapters/react';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import { decodeBase64 } from '@xpert-ai/chatkit-web-shared';

import { HostedApp } from './HostedApp';
import './index.css';
import { ParentMessengerProvider } from './providers/ParentMessenger';
import { useParentMessenger } from './hooks/useParentMessenger';

/**
 * Decode base64 options from URL hash
 */
type ChatKitFrameUrlParams = {
  channelId?: string;
  options?: ChatKitOptions;
};

function decodeFrameParamsFromUrl(): ChatKitFrameUrlParams {
  if (typeof window === 'undefined') return {};

  const hash = window.location.hash;
  const encoded = hash.startsWith('#') ? hash.slice(1) : hash;

  if (!encoded) return {};

  try {
    const params = decodeBase64<ChatKitFrameUrlParams>(encoded);
    return {
      channelId:
        typeof params?.channelId === 'string' && params.channelId.trim()
          ? params.channelId
          : undefined,
      options: params?.options,
    };
  } catch (error) {
    console.warn('[chatkit-ui] Failed to decode options from URL hash:', error);
    return {};
  }
}

const initialClientSecret =
  typeof window === 'undefined'
    ? ''
    : (new URLSearchParams(window.location.search).get('clientSecret') ?? '');

// Parse options from URL on initial load
const initialFrameParams = decodeFrameParamsFromUrl();
const initialOptions = initialFrameParams.options ?? null;

const AppContainer = () => {
  const [options, setOptions] = React.useState<ChatKitOptions | null>(
    initialOptions,
  );
  const parent = useParentMessenger({ onSetOptions: setOptions });
  return (
    <HostedApp
      options={options}
      parent={parent}
      initialClientSecret={initialClientSecret}
    />
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NuqsAdapter>
      <ParentMessengerProvider channelId={initialFrameParams.channelId}>
        <AppContainer />
      </ParentMessengerProvider>
    </NuqsAdapter>
  </React.StrictMode>,
);
