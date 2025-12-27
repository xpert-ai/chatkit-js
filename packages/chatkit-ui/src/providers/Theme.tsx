import * as React from 'react';
import type { ChatKitTheme } from '@xpert-ai/chatkit-types';

export interface ThemeProviderProps {
  children: React.ReactNode;
  theme?: ChatKitTheme | null;
}

/**
 * Parse hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  hex = hex.replace(/^#/, '');

  let r: number, g: number, b: number;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else {
    return null;
  }

  return { r, g, b };
}

/**
 * Calculate relative luminance of a color (0-1)
 * Used to determine if a color is "light" or "dark"
 */
function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const { r, g, b } = rgb;
  // Relative luminance formula
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Convert hex color to HSL values string (without hsl() wrapper)
 * Returns format: "H S% L%" for CSS variable usage
 */
function hexToHslValues(hex: string): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  // Convert to 0-1 range
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Get radius value based on preset
 */
function getRadiusValue(radius: string): string {
  switch (radius) {
    case 'pill':
      return '9999px';
    case 'round':
      return '0.75rem';
    case 'soft':
      return '0.5rem';
    case 'sharp':
      return '0.25rem';
    default:
      return '0.5rem';
  }
}

/**
 * ThemeProvider applies theme configuration via CSS variables
 */
export function ThemeProvider({ children, theme }: ThemeProviderProps) {
  const themeRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!themeRef.current) return;
    const el = themeRef.current;

    // Handle simple color scheme string
    if (typeof theme === 'string') {
      if (theme === 'dark') {
        el.classList.add('dark');
      } else {
        el.classList.remove('dark');
      }
      return;
    }

    if (!theme) return;

    // Handle full theme object
    const { colorScheme, radius, density, typography, color } = theme;

    // Color scheme (light/dark)
    if (colorScheme === 'dark') {
      el.classList.add('dark');
    } else {
      el.classList.remove('dark');
    }

    // Radius
    if (radius) {
      el.dataset.radius = radius;
      el.style.setProperty('--radius', getRadiusValue(radius));
    }

    // Density
    if (density) {
      el.dataset.density = density;
    }

    // Typography
    if (typography) {
      if (typography.baseSize) {
        document.documentElement.style.setProperty('font-size', `${typography.baseSize}px`);
      }
      if (typography.fontFamily) {
        el.style.setProperty('--font-family', typography.fontFamily);
      }
      if (typography.fontFamilyMono) {
        el.style.setProperty('--font-family-mono', typography.fontFamilyMono);
      }

      // Load custom fonts
      if (typography.fontSources && typography.fontSources.length > 0) {
        typography.fontSources.forEach((font) => {
          const fontFace = new FontFace(font.family, `url(${font.src})`, {
            weight: String(font.weight || 400),
            style: font.style || 'normal',
            display: (font.display as FontDisplay) || 'swap',
          });

          fontFace.load().then((loadedFont) => {
            document.fonts.add(loadedFont);
          }).catch((err) => {
            console.warn(`[ThemeProvider] Failed to load font ${font.family}:`, err);
          });
        });
      }
    }

    // Colors
    if (color) {
      // Accent color
      if (color.accent?.primary) {
        const hslValues = hexToHslValues(color.accent.primary);
        if (hslValues) {
          el.style.setProperty('--primary', hslValues);
          // Also set accent to match primary
          el.style.setProperty('--accent', hslValues);
        }
      }

      // Surface colors
      if (color.surface?.background) {
        const hslValues = hexToHslValues(color.surface.background);
        if (hslValues) {
          el.style.setProperty('--background', hslValues);
        }
      }
      if (color.surface?.foreground) {
        const foregroundColor = color.surface.foreground;
        const luminance = getLuminance(foregroundColor);
        const isDarkMode = colorScheme === 'dark';

        // In dark mode, only apply foreground if it's a light color (luminance > 0.5)
        // In light mode, only apply foreground if it's a dark color (luminance <= 0.5)
        // This prevents dark text on dark background or light text on light background
        const shouldApply = isDarkMode ? luminance > 0.5 : luminance <= 0.5;

        if (shouldApply) {
          const hslValues = hexToHslValues(foregroundColor);
          if (hslValues) {
            el.style.setProperty('--foreground', hslValues);
          }
        }
      }
    }

    // Cleanup function
    return () => {
      el.classList.remove('dark');
      el.removeAttribute('data-radius');
      el.removeAttribute('data-density');
      el.style.removeProperty('--radius');
      document.documentElement.style.removeProperty('font-size');
      el.style.removeProperty('--font-family');
      el.style.removeProperty('--font-family-mono');
      el.style.removeProperty('--primary');
      el.style.removeProperty('--accent');
      el.style.removeProperty('--background');
      el.style.removeProperty('--foreground');
    };
  }, [theme]);

  return (
    <div ref={themeRef} className="h-full w-full bg-background text-foreground">
      {children}
    </div>
  );
}

export default ThemeProvider;
