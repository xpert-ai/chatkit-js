export type ChatKitSession = {
  client_secret: string;
  expires_at?: string;
  expires_after?: number;
  apiUrl: string;
  frameUrl: string;
  xpertId: string;
  organizationId?: string | null;
};

export type ChatKitSessionMode = 'proxy' | 'user-api-key';

export type UserApiKeyChatKitConfig = {
  apiUrl: string;
  apiKey: string;
  xpertId: string;
  frameUrl: string;
  expiresAfter?: number;
};

type RuntimeWpsConfig = Partial<UserApiKeyChatKitConfig> & {
  sessionMode?: ChatKitSessionMode;
};

declare global {
  interface Window {
    XPERTAI_WPS_CONFIG?: RuntimeWpsConfig;
  }
}

const LOCAL_CONFIG_STORAGE_KEY = 'xpertai.chatkit.wps.config.v1';
const DEFAULT_EXPIRES_AFTER = 600;
const DEFAULT_API_URL = 'https://api.xpertai.cn/api/ai';
const DEFAULT_FRAME_URL = 'https://app.xpertai.cn/chatkit/index.html';

const SESSION_ENDPOINT =
  (import.meta.env.VITE_CHATKIT_SESSION_URL as string | undefined) ??
  '/api/create-session';

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function readPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readRuntimeConfig(): RuntimeWpsConfig {
  if (typeof window === 'undefined') {
    return {};
  }
  return window.XPERTAI_WPS_CONFIG ?? {};
}

function readStoredConfig(): Partial<UserApiKeyChatKitConfig> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(LOCAL_CONFIG_STORAGE_KEY);
    if (!rawValue) {
      return {};
    }
    const parsed = JSON.parse(rawValue) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Partial<UserApiKeyChatKitConfig>)
      : {};
  } catch {
    return {};
  }
}

function mergeConfig(
  ...configs: Array<Partial<UserApiKeyChatKitConfig>>
): Partial<UserApiKeyChatKitConfig> {
  const merged: Partial<UserApiKeyChatKitConfig> = {};
  for (const config of configs) {
    const apiUrl = readOptionalString(config.apiUrl);
    const apiKey = readOptionalString(config.apiKey);
    const xpertId = readOptionalString(config.xpertId);
    const frameUrl = readOptionalString(config.frameUrl);
    const expiresAfter = readPositiveInteger(config.expiresAfter);

    if (apiUrl) {
      merged.apiUrl = apiUrl;
    }
    if (apiKey) {
      merged.apiKey = apiKey;
    }
    if (xpertId) {
      merged.xpertId = xpertId;
    }
    if (frameUrl) {
      merged.frameUrl = frameUrl;
    }
    if (expiresAfter) {
      merged.expiresAfter = expiresAfter;
    }
  }
  return merged;
}

export function readSessionMode(): ChatKitSessionMode {
  const runtimeMode = readRuntimeConfig().sessionMode;
  if (runtimeMode === 'proxy' || runtimeMode === 'user-api-key') {
    return runtimeMode;
  }

  const envMode = import.meta.env.VITE_CHATKIT_SESSION_MODE as string | undefined;
  if (envMode === 'proxy' || envMode === 'user-api-key') {
    return envMode;
  }

  return import.meta.env.VITE_CHATKIT_SESSION_URL ? 'proxy' : 'user-api-key';
}

export function readUserApiKeyConfigDraft(): Partial<UserApiKeyChatKitConfig> {
  return mergeConfig(
    {
      apiUrl:
        (import.meta.env.VITE_XPERTAI_API_URL as string | undefined) ??
        DEFAULT_API_URL,
      frameUrl:
        (import.meta.env.VITE_XPERTAI_CHATKIT_FRAME_URL as string | undefined) ??
        DEFAULT_FRAME_URL,
      xpertId: import.meta.env.VITE_XPERTAI_XPERT_ID as string | undefined,
      apiKey: import.meta.env.VITE_XPERTAI_API_KEY as string | undefined,
      expiresAfter: readPositiveInteger(
        import.meta.env.VITE_XPERTAI_CLIENT_SECRET_EXPIRES_AFTER,
      ),
    },
    readStoredConfig(),
    readRuntimeConfig(),
  );
}

export function normalizeUserApiKeyConfig(
  input: Partial<UserApiKeyChatKitConfig>,
): UserApiKeyChatKitConfig {
  const apiUrl = readOptionalString(input.apiUrl);
  const apiKey = readOptionalString(input.apiKey);
  const xpertId = readOptionalString(input.xpertId);
  const frameUrl = readOptionalString(input.frameUrl);

  if (!apiUrl) {
    throw new Error('XPERTAI_API_URL is required.');
  }
  if (!apiKey) {
    throw new Error('XPERTAI_API_KEY is required.');
  }
  if (!xpertId) {
    throw new Error('XPERTAI_XPERT_ID is required.');
  }
  if (!frameUrl) {
    throw new Error('XPERTAI_CHATKIT_FRAME_URL is required.');
  }

  return {
    apiUrl: stripTrailingSlash(apiUrl),
    apiKey,
    xpertId,
    frameUrl,
    expiresAfter: readPositiveInteger(input.expiresAfter) ?? DEFAULT_EXPIRES_AFTER,
  };
}

export function readCompleteUserApiKeyConfig(): UserApiKeyChatKitConfig | null {
  try {
    return normalizeUserApiKeyConfig(readUserApiKeyConfigDraft());
  } catch {
    return null;
  }
}

export function saveUserApiKeyConfig(config: UserApiKeyChatKitConfig): void {
  window.localStorage.setItem(LOCAL_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export function clearUserApiKeyConfig(): void {
  window.localStorage.removeItem(LOCAL_CONFIG_STORAGE_KEY);
}

export async function createProxyChatKitSession(
  currentClientSecret?: string | null,
): Promise<ChatKitSession> {
  const response = await fetch(SESSION_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(currentClientSecret ? { currentClientSecret } : {}),
  });

  const payload = (await response.json().catch(() => ({}))) as Partial<
    ChatKitSession & { error: string }
  >;

  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }

  if (!payload.client_secret || !payload.apiUrl || !payload.frameUrl || !payload.xpertId) {
    throw new Error('ChatKit session response is missing required fields.');
  }

  return payload as ChatKitSession;
}

export async function createUserApiKeyChatKitSession(
  config: UserApiKeyChatKitConfig,
): Promise<ChatKitSession> {
  const sessionUrl = `${config.apiUrl}/v1/chatkit/sessions`;
  let response: Response;

  try {
    response = await fetch(sessionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify({
        expires_after: config.expiresAfter ?? DEFAULT_EXPIRES_AFTER,
      }),
    });
  } catch (error) {
    const origin = typeof window === 'undefined' ? 'unknown' : window.location.origin;
    throw new Error(
      `Failed to fetch ${sessionUrl}. Check network access and CORS. The API must allow origin ${origin} and the x-api-key header. ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const payload = (await response.json().catch(() => ({}))) as Partial<
    ChatKitSession & { error: string }
  >;

  if (!response.ok) {
    throw new Error(payload.error || response.statusText || `HTTP ${response.status}`);
  }
  if (!payload.client_secret) {
    throw new Error('Missing client_secret in Xpert ChatKit session response.');
  }

  return {
    client_secret: payload.client_secret,
    expires_at: payload.expires_at,
    expires_after: payload.expires_after ?? config.expiresAfter,
    apiUrl: config.apiUrl,
    frameUrl: config.frameUrl,
    xpertId: config.xpertId,
    organizationId: null,
  };
}

export const createChatKitSession = createProxyChatKitSession;
