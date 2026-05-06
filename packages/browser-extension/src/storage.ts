import { STORAGE_KEY, normalizeConfig } from './config';
import type { ChatKitExtensionConfig } from './types';

export type StorageArea = {
  get: (keys?: string | string[] | null) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
};

export type StorageChange = {
  oldValue?: unknown;
  newValue?: unknown;
};

export type StorageChanges = {
  [key: string]: StorageChange;
};

export type ConfigChangeListener = (
  config: ChatKitExtensionConfig,
) => void | Promise<void>;

export function readConfigFromResult(
  result: Record<string, unknown>,
): ChatKitExtensionConfig {
  return normalizeConfig(result[STORAGE_KEY]);
}

export async function readConfig(
  storage: StorageArea,
): Promise<ChatKitExtensionConfig> {
  return readConfigFromResult(await storage.get(STORAGE_KEY));
}

export async function writeConfig(
  storage: StorageArea,
  config: ChatKitExtensionConfig,
): Promise<void> {
  await storage.set({ [STORAGE_KEY]: normalizeConfig(config) });
}

export function readConfigChange(
  changes: StorageChanges,
): ChatKitExtensionConfig | null {
  const change = changes[STORAGE_KEY];
  if (!change || typeof change.newValue === 'undefined') {
    return null;
  }

  return normalizeConfig(change.newValue);
}
