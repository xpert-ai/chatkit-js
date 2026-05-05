import type { SupportedLocale } from '@xpert-ai/chatkit-types';

import type {
  ChatKitDisplayMode,
  ChatKitExtensionConfig,
  ConfigValidationIssue,
  ConfigValidationResult,
  OverlayPosition,
} from './types';

type ThemeInput = {
  colorScheme?: unknown;
};

type SurfacesInput = {
  sidePanel?: unknown;
  pageOverlay?: unknown;
  autoPageOverlay?: unknown;
};

type OverlayInput = {
  width?: unknown;
  height?: unknown;
  position?: unknown;
};

type HostAutomationInput = {
  enabled?: unknown;
};

type ConfigInput = {
  frameUrl?: unknown;
  apiUrl?: unknown;
  xpertId?: unknown;
  clientSecret?: unknown;
  locale?: unknown;
  displayMode?: unknown;
  theme?: ThemeInput | null;
  surfaces?: SurfacesInput | null;
  overlay?: OverlayInput | null;
  hostAutomation?: HostAutomationInput | null;
};

export const STORAGE_KEY = 'chatkitExtensionConfig';

export const DEFAULT_EXTENSION_CONFIG: ChatKitExtensionConfig = {
  frameUrl: '',
  apiUrl: '',
  xpertId: undefined,
  clientSecret: '',
  locale: undefined,
  displayMode: 'pet',
  theme: { colorScheme: 'light' },
  surfaces: {
    sidePanel: true,
    pageOverlay: true,
    autoPageOverlay: false,
  },
  overlay: {
    width: 420,
    height: 720,
    position: 'bottom-right',
  },
  hostAutomation: {
    enabled: true,
  },
};

export const EXTENSION_LOCALE_OPTIONS = [
  '',
  'en',
  'zh-Hans',
] as const satisfies readonly (SupportedLocale | '')[];

const OVERLAY_POSITIONS = new Set<OverlayPosition>([
  'bottom-right',
  'bottom-left',
  'top-right',
  'top-left',
]);

const DISPLAY_MODES = new Set<ChatKitDisplayMode>(['chat', 'pet']);

function isConfigInput(value: unknown): value is ConfigInput {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isThemeInput(value: unknown): value is ThemeInput {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSurfacesInput(value: unknown): value is SurfacesInput {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOverlayInput(value: unknown): value is OverlayInput {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHostAutomationInput(value: unknown): value is HostAutomationInput {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalString(value: unknown): string | undefined {
  const normalized = normalizeString(value);
  return normalized ? normalized : undefined;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeColorScheme(value: unknown): 'light' | 'dark' | undefined {
  return value === 'light' || value === 'dark' ? value : undefined;
}

function normalizeDisplayMode(value: unknown): ChatKitDisplayMode {
  return typeof value === 'string' &&
    DISPLAY_MODES.has(value as ChatKitDisplayMode)
    ? (value as ChatKitDisplayMode)
    : DEFAULT_EXTENSION_CONFIG.displayMode;
}

function normalizeLocale(value: unknown): SupportedLocale | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const comparable = normalized.toLowerCase();
  if (
    comparable === 'zh' ||
    comparable === 'zh-cn' ||
    comparable === 'zh-hans'
  ) {
    return 'zh-Hans';
  }

  if (comparable === 'en' || comparable.startsWith('en-')) {
    return 'en';
  }

  return undefined;
}

function normalizeOverlayNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeOverlayPosition(value: unknown): OverlayPosition {
  return typeof value === 'string' &&
    OVERLAY_POSITIONS.has(value as OverlayPosition)
    ? (value as OverlayPosition)
    : DEFAULT_EXTENSION_CONFIG.overlay.position;
}

export function normalizeConfig(value: unknown): ChatKitExtensionConfig {
  const source = isConfigInput(value) ? value : {};
  const sourceTheme = isThemeInput(source.theme) ? source.theme : {};
  const sourceSurfaces = isSurfacesInput(source.surfaces)
    ? source.surfaces
    : {};
  const sourceOverlay = isOverlayInput(source.overlay) ? source.overlay : {};
  const sourceHostAutomation = isHostAutomationInput(source.hostAutomation)
    ? source.hostAutomation
    : {};
  const colorScheme = normalizeColorScheme(sourceTheme.colorScheme);

  return {
    frameUrl: normalizeString(source.frameUrl),
    apiUrl: normalizeString(source.apiUrl),
    xpertId: optionalString(source.xpertId),
    clientSecret: normalizeString(source.clientSecret),
    locale: normalizeLocale(source.locale),
    displayMode: normalizeDisplayMode(source.displayMode),
    theme: {
      colorScheme:
        colorScheme ?? DEFAULT_EXTENSION_CONFIG.theme?.colorScheme ?? 'light',
    },
    surfaces: {
      sidePanel: normalizeBoolean(
        sourceSurfaces.sidePanel,
        DEFAULT_EXTENSION_CONFIG.surfaces.sidePanel,
      ),
      pageOverlay: normalizeBoolean(
        sourceSurfaces.pageOverlay,
        DEFAULT_EXTENSION_CONFIG.surfaces.pageOverlay,
      ),
      autoPageOverlay: normalizeBoolean(
        sourceSurfaces.autoPageOverlay,
        DEFAULT_EXTENSION_CONFIG.surfaces.autoPageOverlay,
      ),
    },
    overlay: {
      width: normalizeOverlayNumber(
        sourceOverlay.width,
        DEFAULT_EXTENSION_CONFIG.overlay.width,
        320,
        900,
      ),
      height: normalizeOverlayNumber(
        sourceOverlay.height,
        DEFAULT_EXTENSION_CONFIG.overlay.height,
        360,
        1200,
      ),
      position: normalizeOverlayPosition(sourceOverlay.position),
    },
    hostAutomation: {
      enabled: normalizeBoolean(
        sourceHostAutomation.enabled,
        DEFAULT_EXTENSION_CONFIG.hostAutomation.enabled,
      ),
    },
  };
}

export function validateConfig(
  config: ChatKitExtensionConfig,
): ConfigValidationResult {
  const issues: ConfigValidationIssue[] = [];

  if (!config.frameUrl) {
    issues.push({
      field: 'frameUrl',
      message: 'ChatKit frame URL is required.',
    });
  }

  if (!config.apiUrl) {
    issues.push({
      field: 'apiUrl',
      message: 'Xpert API URL is required.',
    });
  }

  if (!config.clientSecret) {
    issues.push({
      field: 'clientSecret',
      message: 'Client Secret / API Key is required.',
    });
  }

  return issues.length === 0 ? { ok: true, issues: [] } : { ok: false, issues };
}

export function getMissingConfigMessage(
  validation: ConfigValidationResult,
): string {
  if (validation.ok) {
    return '';
  }

  return validation.issues.map((issue) => issue.message).join(' ');
}
