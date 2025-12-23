/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHATKIT_API_BASE?: string;
  readonly VITE_CHATKIT_ASSISTANT_ID?: string;
  readonly VITE_CHATKIT_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
