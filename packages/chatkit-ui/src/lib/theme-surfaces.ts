import type { CSSProperties } from 'react';
import type { ChatKitTheme } from '@xpert-ai/chatkit-types';

/**
 * Get density spacing multiplier
 * compact: 0.75, normal: 1, spacious: 1.25
 */
export function getDensitySpacing(density: 'compact' | 'normal' | 'spacious'): {
  spacing: number;
  padding: string;
  gap: string;
} {
  switch (density) {
    case 'compact':
      return { spacing: 0.75, padding: '0.5rem', gap: '0.25rem' };
    case 'spacious':
      return { spacing: 1.25, padding: '1.5rem', gap: '1rem' };
    case 'normal':
    default:
      return { spacing: 1, padding: '1rem', gap: '0.5rem' };
  }
}

// Match the existing panel/menu presets, without turning multi-row surfaces into pills.
const panelRadius = {
  sharp: '0px',
  soft: 'var(--radius, 0.625rem)',
  round: 'calc(var(--radius, 0.625rem) + 4px)',
  pill: 'calc(var(--radius, 0.625rem) + 12px)',
};
const itemRadius = {
  sharp: '0px',
  soft: 'max(0px, calc(var(--radius, 0.625rem) - 2px))',
  round: 'var(--radius, 0.625rem)',
  pill: 'calc(var(--radius, 0.625rem) + 4px)',
};

/** Explicit tokens also work in Radix portals, outside the ThemeProvider DOM root. */
export function getSurfaceThemeStyle(theme: ChatKitTheme): CSSProperties {
  const radius = theme.radius ?? 'soft';
  return {
    '--chat-panel-radius': panelRadius[radius],
    '--chat-item-radius': itemRadius[radius],
    '--chat-density-scale': getDensitySpacing(theme.density ?? 'normal')
      .spacing,
  } as CSSProperties;
}
