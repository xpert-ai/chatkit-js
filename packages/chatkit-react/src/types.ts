/**
 * Type definitions for Xpert ChatKit React
 */

import type { ChatKitOptions } from '@xpert-ai/chatkit-types';

// Re-export types from chatkit-types for convenience
export type { ChatKitOptions } from '@xpert-ai/chatkit-types';

/**
 * Options for useXpertChatKit hook
 */
export interface UseChatKitOptions {
  api: {
    /**
     * Function to get the client secret for authentication.
     * This is called when the component mounts and can be called again to refresh.
     * The current secret (if any) is passed to allow for refresh logic.
     */
    getClientSecret: (existing: string | null) => Promise<string>;
  }

  /**
   * The base URL of the ChatKit iframe (without options parameter)
   */
  chatkitUrl: string;

  /**
   * ChatKit options configuration (theme, composer, startScreen, etc.)
   * Will be encoded as base64 and appended to the URL
   */
  options?: ChatKitOptions;

  /**
   * Callback when an error occurs during secret fetching
   */
  onError?: (error: Error) => void;

  /**
   * Callback when the client secret is successfully obtained
   */
  onSecretReady?: (secret: string) => void;
}

/**
 * State of the chatkit connection
 */
export type ChatKitStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Control object returned by useChatKit
 */
export interface ChatKitControl {
  /**
   * Current status of the chatkit connection
   */
  status: ChatKitStatus;

  /**
   * Current client secret (null if not yet obtained)
   */
  clientSecret: string | null;

  /**
   * Error if status is 'error'
   */
  error: Error | null;

  /**
   * The full chatkit URL with options encoded
   */
  chatkitUrl: string;

  /**
   * Manually refresh the client secret
   */
  refreshSecret: () => Promise<void>;
}

/**
 * Return type of useChatKit hook
 */
export interface UseChatKitReturn {
  /**
   * Control object to pass to XpertChatKit component
   */
  control: ChatKitControl;
}

/**
 * Props for XpertChatKit component
 */
export interface XpertChatKitProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Control object from useXpertChatKit hook
   */
  control: ChatKitControl;
}

/**
 * Declare the custom element for TypeScript/JSX
 */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'xpert-chatkit': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'chatkit-url'?: string;
          'client-secret'?: string;
        },
        HTMLElement
      >;
      'openai-chatkit': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'chatkit-url'?: string;
          'client-secret'?: string;
        },
        HTMLElement
      >;
    }
  }
}
