import type { SupportedLocale } from '@xpert-ai/chatkit-types';

export type OverlayPosition =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left';

export type ChatKitDisplayMode = 'chat' | 'pet';

export type ChatKitExtensionConfig = {
  frameUrl: string;
  apiUrl: string;
  xpertId?: string;
  clientSecret: string;
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
  hostAutomation: {
    enabled: boolean;
  };
};

export type ConfigValidationIssue = {
  field: keyof Pick<
    ChatKitExtensionConfig,
    'frameUrl' | 'apiUrl' | 'clientSecret'
  >;
  message: string;
};

export type ConfigValidationResult =
  | { ok: true; issues: [] }
  | { ok: false; issues: ConfigValidationIssue[] };
