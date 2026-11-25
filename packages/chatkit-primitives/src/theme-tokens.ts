import type { CSSProperties } from 'react';
export interface SurfaceTheme {
  radius?: 'sharp' | 'soft' | 'round' | 'pill';
  density?: 'compact' | 'normal' | 'spacious';
}

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
export function getThemeRadii(
  radius: SurfaceTheme['radius'] = 'soft',
  baseRadius = 'var(--radius, 0.625rem)',
) {
  const panelRadius = {
    sharp: '0px',
    soft: baseRadius,
    round: `calc(${baseRadius} + 4px)`,
    pill: `calc(${baseRadius} + 12px)`,
  };
  const itemRadius = {
    sharp: '0px',
    soft: `max(0px, calc(${baseRadius} - 2px))`,
    round: baseRadius,
    pill: `calc(${baseRadius} + 4px)`,
  };
  // Percentages keep each silhouette proportional to its tile across densities.
  const avatarRadius = { sharp: '0%', soft: '20%', round: '28%', pill: '50%' };
  return {
    panel: panelRadius[radius],
    item: itemRadius[radius],
    avatar: avatarRadius[radius],
  };
}

/** Explicit tokens also work in Radix portals, outside the ThemeProvider DOM root. */
export function getSurfaceThemeStyle(theme: SurfaceTheme): CSSProperties {
  const radius = getThemeRadii(theme.radius);
  return {
    '--chat-panel-radius': radius.panel,
    '--chat-item-radius': radius.item,
    '--chat-avatar-radius': radius.avatar,
    '--density-padding': getDensitySpacing(theme.density ?? 'normal').padding,
    '--density-gap': getDensitySpacing(theme.density ?? 'normal').gap,
    '--chat-density-scale': getDensitySpacing(theme.density ?? 'normal')
      .spacing,
  } as CSSProperties;
}
