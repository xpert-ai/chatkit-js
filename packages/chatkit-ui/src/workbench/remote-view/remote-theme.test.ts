import { describe, expect, it } from 'vitest';
import { createRemoteTheme } from './remote-theme';

describe('remote warning color', () => {
  it.each([
    { dark: false, radius: 'sharp' as const, expected: '#b45309' },
    { dark: true, radius: 'round' as const, expected: '#fbbf24' },
  ])(
    'keeps a semantic warning when the host has no token: $dark',
    ({ dark, radius, expected }) => {
      const surface = document.createElement('div');
      surface.style.setProperty('--primary', '#18181b');
      document.body.append(surface);
      try {
        const theme = createRemoteTheme(surface, dark, radius);
        expect(theme.tokens.colorWarning).toBe(expected);
        expect(theme.tokens.colorWarning).not.toBe(theme.tokens.colorPrimary);
      } finally {
        surface.remove();
      }
    },
  );

  it('inherits custom warning colors when the host theme changes', () => {
    const surface = document.createElement('div');
    document.body.append(surface);
    try {
      surface.style.setProperty('--warning', '#8a5800');
      expect(
        createRemoteTheme(surface, false, 'soft').tokens.colorWarning,
      ).toBe('#8a5800');
      surface.style.setProperty('--warning', '#ffd060');
      expect(
        createRemoteTheme(surface, true, 'round').tokens.colorWarning,
      ).toBe('#ffd060');
    } finally {
      surface.remove();
    }
  });
});
