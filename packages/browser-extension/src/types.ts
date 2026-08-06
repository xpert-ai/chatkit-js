import type { SupportedLocale } from '@xpert-ai/chatkit-types';

export type OverlayPosition =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left';

export type ChatKitDisplayMode = 'chat' | 'pet';

export type ChatKitPetConfig = {
  scale: number;
  boundsPadding: number;
};

export type ChatKitAssistantConfig = {
  id: string;
  name?: string;
  clientSecret: string;
};

export type ChatKitExtensionConfig = {
  frameUrl: string;
  apiUrl: string;
  assistants: ChatKitAssistantConfig[];
  activeAssistantId?: string;
  locale?: SupportedLocale;
  displayMode: ChatKitDisplayMode;
  theme?: { colorScheme?: 'light' | 'dark' };
  surfaces: {
    sidePanel: boolean;
    pageOverlay: boolean;
    autoPageOverlay: boolean;
  };
  overlay: {
    width: number;
    height: number;
    position: OverlayPosition;
  };
  pet: ChatKitPetConfig;
  hostAutomation: {
    enabled: boolean;
    provider: 'current_tab' | 'isolated_runner';
  };
};

export type ConfigValidationIssue = {
  field: 'frameUrl' | 'apiUrl' | 'clientSecret';
  message: string;
};

export type ConfigValidationResult =
  | { ok: true; issues: [] }
  | { ok: false; issues: ConfigValidationIssue[] };
