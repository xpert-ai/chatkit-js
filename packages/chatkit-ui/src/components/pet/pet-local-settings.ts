import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import { normalizePetOptions } from '@xpert-ai/chatkit-types';
import {
  getIncludedPetCharacter,
  getIncludedPetIdByCharacter,
  getIncludedPetOption,
  type ChatKitIncludedPetId,
} from './builtinPets';

export const PET_LOCAL_SETTINGS_STORAGE_KEY = 'chatkit:pet:settings:v1';

export type PetLocalCharacterType = 'builtin' | 'atlas';

export type PetLocalSettings = {
  enabled: boolean;
  characterType: PetLocalCharacterType;
  builtinId: ChatKitIncludedPetId;
  atlasUrl: string;
  scale: number;
  draggable: boolean;
  persistPosition: boolean;
};

export type PetCommandMode = 'toggle' | 'on' | 'off' | 'settings';

export const DEFAULT_PET_LOCAL_SETTINGS: PetLocalSettings = {
  enabled: false,
  characterType: 'builtin',
  builtinId: 'boba',
  atlasUrl: '',
  scale: 0.25,
  draggable: true,
  persistPosition: true,
};

const CHARACTER_TYPES = new Set<PetLocalCharacterType>([
  'builtin',
  'atlas',
]);

function clampScale(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_PET_LOCAL_SETTINGS.scale;
  }
  return Math.min(2, Math.max(0.1, numeric));
}

function parsePetLocalSettings(value: unknown): PetLocalSettings | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const settings = value as {
    enabled?: unknown;
    characterType?: unknown;
    builtinId?: unknown;
    atlasUrl?: unknown;
    scale?: unknown;
    draggable?: unknown;
    persistPosition?: unknown;
  };
  const characterType = CHARACTER_TYPES.has(
    settings.characterType as PetLocalCharacterType,
  )
    ? (settings.characterType as PetLocalCharacterType)
    : DEFAULT_PET_LOCAL_SETTINGS.characterType;
  const includedPet =
    typeof settings.builtinId === 'string'
      ? getIncludedPetOption(settings.builtinId)
      : undefined;
  const builtinId = includedPet?.id ?? DEFAULT_PET_LOCAL_SETTINGS.builtinId;

  return {
    enabled:
      typeof settings.enabled === 'boolean'
        ? settings.enabled
        : DEFAULT_PET_LOCAL_SETTINGS.enabled,
    characterType:
      characterType === 'atlas' && typeof settings.atlasUrl === 'string'
        ? 'atlas'
        : DEFAULT_PET_LOCAL_SETTINGS.characterType,
    builtinId,
    atlasUrl: typeof settings.atlasUrl === 'string' ? settings.atlasUrl : '',
    scale: clampScale(settings.scale),
    draggable:
      typeof settings.draggable === 'boolean'
        ? settings.draggable
        : DEFAULT_PET_LOCAL_SETTINGS.draggable,
    persistPosition:
      typeof settings.persistPosition === 'boolean'
        ? settings.persistPosition
        : DEFAULT_PET_LOCAL_SETTINGS.persistPosition,
  };
}

export function readPetLocalSettings(): PetLocalSettings | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(PET_LOCAL_SETTINGS_STORAGE_KEY);
    return raw ? parsePetLocalSettings(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writePetLocalSettings(settings: PetLocalSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      PET_LOCAL_SETTINGS_STORAGE_KEY,
      JSON.stringify(settings),
    );
  } catch {
    // Local settings are best-effort.
  }
}

export function buildPetOptionsFromLocalSettings(
  settings: PetLocalSettings,
): ChatKitOptions['pet'] | null {
  if (!settings.enabled) {
    return null;
  }

  const position = {
    draggable: settings.draggable,
    persist: settings.persistPosition,
    scale: settings.scale,
  };

  if (settings.characterType === 'atlas' && settings.atlasUrl.trim()) {
    return {
      character: {
        type: 'sprite-atlas',
        src: settings.atlasUrl.trim(),
      },
      position,
    };
  }

  return {
    character: getIncludedPetCharacter(settings.builtinId),
    position,
  };
}

export function derivePetLocalSettings(
  pet: ChatKitOptions['pet'] | null | undefined,
): PetLocalSettings {
  if (!pet) {
    return { ...DEFAULT_PET_LOCAL_SETTINGS };
  }

  const normalized = normalizePetOptions(pet ?? null);
  if (!normalized) {
    return { ...DEFAULT_PET_LOCAL_SETTINGS };
  }

  const base: PetLocalSettings = {
    ...DEFAULT_PET_LOCAL_SETTINGS,
    enabled: true,
    scale: normalized.position.scale,
    draggable: normalized.position.draggable,
    persistPosition: normalized.position.persist,
  };

  const character = normalized.character;
  const includedPetId = getIncludedPetIdByCharacter(character);
  if (includedPetId) {
    return {
      ...base,
      characterType: 'builtin',
      builtinId: includedPetId,
    };
  }

  if (character.src) {
    return {
      ...base,
      characterType: 'atlas',
      atlasUrl: character.src,
    };
  }

  return base;
}

export function isPetEnabled(pet: ChatKitOptions['pet'] | null | undefined) {
  return Boolean(normalizePetOptions(pet ?? null));
}

export function resolvePetCommandMode(args: string): PetCommandMode {
  const normalized = args.trim().toLowerCase();
  if (!normalized) {
    return 'toggle';
  }

  if (['on', 'enable', 'enabled', 'true'].includes(normalized)) {
    return 'on';
  }

  if (['off', 'disable', 'disabled', 'false'].includes(normalized)) {
    return 'off';
  }

  if (['settings', 'setting', 'config', 'configure'].includes(normalized)) {
    return 'settings';
  }

  return 'toggle';
}
