import * as React from 'react';
import type { XpertChatKitProps } from './types';

// Import web component side effect
import { registerChatKitElement } from '@xpert-ai/chatkit-web-component';

registerChatKitElement()

/**
 * React component that wraps the xpert-chatkit web component
 *
 */
export const XpertChatKit = React.forwardRef<HTMLElement, XpertChatKitProps>(
  function XpertChatKit({ control, ...htmlProps }, forwardedRef) {
    const { status, clientSecret, chatkitUrl, error } = control;

    // Show loading state
    if (status === 'loading' || status === 'idle') {
      return (
        <div
          {...htmlProps}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...htmlProps.style,
          }}
        >
          <div style={{ color: '#666', fontSize: '14px' }}>Loading...</div>
        </div>
      );
    }

    // Show error state
    if (status === 'error') {
      return (
        <div
          {...htmlProps}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...htmlProps.style,
          }}
        >
          <div style={{ color: '#dc3545', fontSize: '14px' }}>
            {error?.message || 'Failed to initialize chat'}
          </div>
        </div>
      );
    }

    // Render the web component
    // Options are already encoded in the chatkitUrl
    return (
      <openai-chatkit
        ref={forwardedRef}
        chatkit-url={chatkitUrl}
        client-secret={clientSecret || undefined}
        {...htmlProps}
      />
    );
  }
);
