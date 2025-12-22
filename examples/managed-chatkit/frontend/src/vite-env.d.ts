/// <reference types="vite/client" />

// Declare custom element for TypeScript
declare namespace JSX {
  interface IntrinsicElements {
    'xpert-chatkit': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        'backend-url'?: string;
        'chatkit-url'?: string;
        'assistant-id'?: string;
        'style-config'?: string;
      },
      HTMLElement
    >;
  }
}
