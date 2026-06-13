import type { SupportedLocale } from '@xpert-ai/chatkit-types';

import type {
  ChatKitAssistantConfig,
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

type PetInput = {
  scale?: unknown;
  boundsPadding?: unknown;
};

type HostAutomationInput = {
  enabled?: unknown;
};

type AssistantInput = {
  id?: unknown;
  name?: unknown;
  clientSecret?: unknown;
};

type ConfigInput = {
  frameUrl?: unknown;
  apiUrl?: unknown;
  xpertId?: unknown;
  assistants?: unknown;
  activeAssistantId?: unknown;
  clientSecret?: unknown;
  locale?: unknown;
  displayMode?: unknown;
  theme?: ThemeInput | null;
  surfaces?: SurfacesInput | null;
  overlay?: OverlayInput | null;
  pet?: PetInput | null;
  hostAutomation?: HostAutomationInput | null;
};

export const STORAGE_KEY = 'chatkitExtensionConfig';

export const DEFAULT_EXTENSION_CONFIG: ChatKitExtensionConfig = {
  frameUrl: 'https://app.xpertai.cn/chatkit',
  apiUrl: 'https://api.xpertai.cn/api/ai',
  assistants: [],
  activeAssistantId: undefined,
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
  pet: {
    scale: 1,
    boundsPadding: 50,
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

function isPetInput(value: unknown): value is PetInput {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHostAutomationInput(value: unknown): value is HostAutomationInput {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAssistantInput(value: unknown): value is AssistantInput {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringWithDefault(value: unknown, fallback: string): string {
  return normalizeString(value) || fallback;
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

function normalizePetScale(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_EXTENSION_CONFIG.pet.scale;
  }

  return Math.min(2, Math.max(0.1, numeric));
}

function normalizePetBoundsPadding(value: unknown): number {
  return normalizeOverlayNumber(
    value,
    DEFAULT_EXTENSION_CONFIG.pet.boundsPadding,
    0,
    500,
  );
}

function normalizeAssistants(
  value: unknown,
  legacyXpertId?: string,
  legacyClientSecret = '',
): ChatKitAssistantConfig[] {
  const sourceAssistants = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const assistants: ChatKitAssistantConfig[] = [];

  for (const entry of sourceAssistants) {
    if (!isAssistantInput(entry)) {
      continue;
    }

    const id = normalizeString(entry.id);
    if (!id || seen.has(id)) {
      continue;
    }

    seen.add(id);
    const name = optionalString(entry.name);
    const clientSecret =
      normalizeString(entry.clientSecret) || legacyClientSecret;
    assistants.push({
      id,
      clientSecret,
      ...(name ? { name } : {}),
    });
  }

  if (assistants.length || !legacyXpertId) {
    return assistants;
  }

  return [{ id: legacyXpertId, clientSecret: legacyClientSecret }];
}

function normalizeActiveAssistantId(
  value: unknown,
  assistants: ChatKitAssistantConfig[],
): string | undefined {
  const activeAssistantId = optionalString(value);
  if (
    activeAssistantId &&
    assistants.some((assistant) => assistant.id === activeAssistantId)
  ) {
    return activeAssistantId;
  }

  return assistants[0]?.id;
}

export function normalizeConfig(value: unknown): ChatKitExtensionConfig {
  const source = isConfigInput(value) ? value : {};
  const sourceTheme = isThemeInput(source.theme) ? source.theme : {};
  const sourceSurfaces = isSurfacesInput(source.surfaces)
    ? source.surfaces
    : {};
  const sourceOverlay = isOverlayInput(source.overlay) ? source.overlay : {};
  const sourcePet = isPetInput(source.pet) ? source.pet : {};
  const sourceHostAutomation = isHostAutomationInput(source.hostAutomation)
    ? source.hostAutomation
    : {};
  const colorScheme = normalizeColorScheme(sourceTheme.colorScheme);
  const legacyXpertId = optionalString(source.xpertId);
  const legacyClientSecret = normalizeString(source.clientSecret);
  const assistants = normalizeAssistants(
    source.assistants,
    legacyXpertId,
    legacyClientSecret,
  );
  const activeAssistantId = normalizeActiveAssistantId(
    source.activeAssistantId ?? legacyXpertId,
    assistants,
  );

  return {
    frameUrl: normalizeStringWithDefault(
      source.frameUrl,
      DEFAULT_EXTENSION_CONFIG.frameUrl,
    ),
    apiUrl: normalizeStringWithDefault(
      source.apiUrl,
      DEFAULT_EXTENSION_CONFIG.apiUrl,
    ),
    assistants,
    activeAssistantId,
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
    pet: {
      scale: normalizePetScale(sourcePet.scale),
      boundsPadding: normalizePetBoundsPadding(sourcePet.boundsPadding),
    },
    hostAutomation: {
      enabled: normalizeBoolean(
        sourceHostAutomation.enabled,
        DEFAULT_EXTENSION_CONFIG.hostAutomation.enabled,
      ),
    },
  };
}

export function getActiveAssistant(
  config: ChatKitExtensionConfig,
): ChatKitAssistantConfig | undefined {
  return config.assistants.find(
    (assistant) => assistant.id === config.activeAssistantId,
  );
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

  if (
    config.assistants.length === 0 ||
    config.assistants.some((assistant) => !assistant.clientSecret)
  ) {
    issues.push({
      field: 'clientSecret',
      message: 'Client Secret / API Key is required for each assistant.',
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
