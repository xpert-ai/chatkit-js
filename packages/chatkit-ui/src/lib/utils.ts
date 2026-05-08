import type { ChatKitTheme } from '@xpert-ai/chatkit-types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ThemeRadiusPreset = NonNullable<ChatKitTheme['radius']>;

const THEME_RADIUS_PRESET_CLASS: Record<ThemeRadiusPreset, string> = {
  pill: 'rounded-full',
  round: 'rounded-xl',
  soft: 'rounded-lg',
  sharp: 'rounded-none',
};

const THEME_PANEL_RADIUS_PRESET_CLASS: Record<ThemeRadiusPreset, string> = {
  pill: 'rounded-3xl',
  round: 'rounded-xl',
  soft: 'rounded-lg',
  sharp: 'rounded-none',
};

const THEME_COMPOSER_INPUT_RADIUS_PRESET_CLASS: Record<
  ThemeRadiusPreset,
  string
> = {
  pill: 'rounded-3xl',
  round: 'rounded-xl',
  soft: 'rounded-lg',
  sharp: 'rounded-none',
};

const THEME_MENU_ITEM_RADIUS_PRESET_CLASS: Record<ThemeRadiusPreset, string> = {
  pill: 'rounded-xl',
  round: 'rounded-lg',
  soft: 'rounded-md',
  sharp: 'rounded-none',
};

export function getRoundedClass(
  themeRadius: ThemeRadiusPreset | undefined,
  fallback = 'rounded-full',
) {
  return themeRadius ? THEME_RADIUS_PRESET_CLASS[themeRadius] : fallback;
}

export function getPanelRoundedClass(
  themeRadius: ThemeRadiusPreset | undefined,
  fallback: ThemeRadiusPreset = 'soft',
) {
  return THEME_PANEL_RADIUS_PRESET_CLASS[themeRadius ?? fallback];
}

type ComposerInputRoundedClassOptions = {
  fallback?: ThemeRadiusPreset;
  isEmpty?: boolean;
  isStacked?: boolean;
};

export function getComposerInputRoundedClass(
  themeRadius: ThemeRadiusPreset | undefined,
  options: ComposerInputRoundedClassOptions = {},
) {
  const radius = themeRadius ?? options.fallback ?? 'round';
  if (radius === 'pill' && options.isEmpty && !options.isStacked) {
    return 'rounded-full';
  }
  return THEME_COMPOSER_INPUT_RADIUS_PRESET_CLASS[radius];
}

export function getMenuItemRoundedClass(
  themeRadius: ThemeRadiusPreset | undefined,
  fallback: ThemeRadiusPreset = 'soft',
) {
  return THEME_MENU_ITEM_RADIUS_PRESET_CLASS[themeRadius ?? fallback];
}

export function createMessageId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}
