import * as React from 'react';
import type { XpertChatkitProps } from './types';

// Import web component side effect
import '@xpert-ai/chatkit-web-component';

/**
 * React component that wraps the xpert-chatkit web component
 *
 * @example
 * ```tsx
 * const { control } = useXpertChatkit({
 *   chatkitUrl: 'https://chatkit.example.com',
 *   getClientSecret: async () => { ... },
 *   options: {
 *     theme: { colorScheme: 'dark' },
 *   },
 * });
 *
 * return <XpertChatkit control={control} className="h-full" />;
 * ```
 */
export const XpertChatkit = React.forwardRef<HTMLElement, XpertChatkitProps>(
  function XpertChatkit({ control, ...htmlProps }, forwardedRef) {
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
      <xpert-chatkit
        ref={forwardedRef}
        chatkit-url={chatkitUrl}
        client-secret={clientSecret || undefined}
        {...htmlProps}
      />
    );
  }
);
