/**
 * Type definitions for Xpert Chatkit React
 */

import type { XpertChatkitOptions } from '@xpert-ai/chatkit-types';

// Re-export types from chatkit-types for convenience
export type { XpertChatkitOptions } from '@xpert-ai/chatkit-types';

/**
 * Options for useXpertChatkit hook
 */
export interface UseXpertChatkitOptions {
  /**
   * Function to get the client secret for authentication.
   * This is called when the component mounts and can be called again to refresh.
   * The current secret (if any) is passed to allow for refresh logic.
   */
  getClientSecret: (currentSecret: string | null) => Promise<string>;

  /**
   * The base URL of the Chatkit iframe (without options parameter)
   */
  chatkitUrl: string;

  /**
   * Chatkit options configuration (theme, composer, startScreen, etc.)
   * Will be encoded as base64 and appended to the URL
   */
  options?: XpertChatkitOptions;

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
export type ChatkitStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Control object returned by useXpertChatkit
 */
export interface ChatkitControl {
  /**
   * Current status of the chatkit connection
   */
  status: ChatkitStatus;

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
 * Return type of useXpertChatkit hook
 */
export interface UseXpertChatkitReturn {
  /**
   * Control object to pass to XpertChatkit component
   */
  control: ChatkitControl;
}

/**
 * Props for XpertChatkit component
 */
export interface XpertChatkitProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Control object from useXpertChatkit hook
   */
  control: ChatkitControl;
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
    }
  }
}
