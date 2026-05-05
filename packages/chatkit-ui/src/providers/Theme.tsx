import * as React from 'react';
import type { ChatKitTheme, ColorScheme, GrayscaleOptions } from '@xpert-ai/chatkit-types';

export interface ThemeProviderProps {
  children: React.ReactNode;
  /**
   * Theme configuration. Accepts ChatKitTheme object or ColorScheme string for backward compatibility.
   * ColorScheme string will be normalized to ChatKitTheme object internally.
   * @preferred ChatKitTheme
   */
  theme?: ChatKitTheme | ColorScheme;
}

interface ThemeContextValue {
  /**
   * Normalized theme configuration as ChatKitTheme object.
   * ColorScheme strings are converted to ChatKitTheme for consistent access.
   */
  theme: ChatKitTheme;
  isDarkMode: boolean;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
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
 * Convert hex color to OKLCH CSS color string
 * Returns format: "oklch(L C H)" for CSS variable usage
 * Uses proper sRGB → Linear RGB → OKLab → OKLCH conversion
 */
function hexToOklch(hex: string): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  // Convert sRGB to linear RGB
  const toLinear = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };

  const lr = toLinear(rgb.r);
  const lg = toLinear(rgb.g);
  const lb = toLinear(rgb.b);

  // Convert linear RGB to OKLab using the proper matrix
  // Step 1: Linear RGB to LMS
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  // Step 2: LMS to LMS' (cube root)
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  // Step 3: LMS' to OKLab
  const okL = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const okA = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const okB = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  // Step 4: OKLab to OKLCH
  const okC = Math.sqrt(okA * okA + okB * okB);
  const okH = Math.atan2(okB, okA) * (180 / Math.PI);
  const normalizedH = okH < 0 ? okH + 360 : okH;

  return `oklch(${okL.toFixed(3)} ${okC.toFixed(3)} ${normalizedH.toFixed(1)})`;
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const sNorm = s / 100;
  const lNorm = l / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

/**
 * Convert RGB to OKLCH (helper function)
 */
function rgbToOklch(r: number, g: number, b: number): string {
  // Convert sRGB to linear RGB
  const toLinear = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };

  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  // Convert linear RGB to OKLab
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const okL = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const okA = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const okB = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  const okC = Math.sqrt(okA * okA + okB * okB);
  const okH = Math.atan2(okB, okA) * (180 / Math.PI);
  const normalizedH = okH < 0 ? okH + 360 : okH;

  return `oklch(${okL.toFixed(3)} ${okC.toFixed(3)} ${normalizedH.toFixed(1)})`;
}

/**
 * Create OKLCH CSS color string from h, s, l components (HSL input)
 * Converts HSL to RGB then to OKLCH for accurate conversion
 */
function hslToOklch(h: number, s: number, l: number): string {
  const rgb = hslToRgb(h, s, l);
  return rgbToOklch(rgb.r, rgb.g, rgb.b);
}

/**
 * Get density spacing multiplier
 * compact: 0.75, normal: 1, spacious: 1.25
 */
function getDensitySpacing(density: 'compact' | 'normal' | 'spacious'): {
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

/**
 * Generate grayscale color palette based on hue and tint
 * This creates colors for muted, border, card, etc.
 */
function generateGrayscaleColors(
  grayscale: GrayscaleOptions,
  isDarkMode: boolean
): Record<string, string> {
  const { hue, tint } = grayscale;
  // tint: 0-9, where 0 is pure gray and 9 is most colored
  const saturation = tint * 3; // 0% to 27%

  if (isDarkMode) {
    // Dark mode: lighter backgrounds, darker text
    return {
      muted: hslToOklch(hue, saturation, 15),
      'muted-foreground': hslToOklch(hue, saturation, 65),
      border: hslToOklch(hue, saturation, 20),
      card: hslToOklch(hue, saturation, 12),
      'card-foreground': hslToOklch(hue, saturation, 95),
      popover: hslToOklch(hue, saturation, 10),
      'popover-foreground': hslToOklch(hue, saturation, 95),
      secondary: hslToOklch(hue, saturation, 20),
      'secondary-foreground': hslToOklch(hue, saturation, 95),
    };
  } else {
    // Light mode: darker backgrounds, lighter text
    return {
      muted: hslToOklch(hue, saturation, 96),
      'muted-foreground': hslToOklch(hue, saturation, 45),
      border: hslToOklch(hue, saturation, 90),
      card: hslToOklch(hue, saturation, 100),
      'card-foreground': hslToOklch(hue, saturation, 10),
      popover: hslToOklch(hue, saturation, 100),
      'popover-foreground': hslToOklch(hue, saturation, 10),
      secondary: hslToOklch(hue, saturation, 96),
      'secondary-foreground': hslToOklch(hue, saturation, 10),
    };
  }
}

/**
 * ThemeProvider applies theme configuration via CSS variables
 */
export function ThemeProvider({ children, theme: themeProp }: ThemeProviderProps) {
  const themeRef = React.useRef<HTMLDivElement>(null);

  // Normalize theme to ChatKitTheme object
  const theme = React.useMemo<ChatKitTheme>(() => {
    if (typeof themeProp === 'string') {
      // Convert ColorScheme string to ChatKitTheme object
      return {
        colorScheme: themeProp,
      };
    }
    return themeProp || {};
  }, [themeProp]);

  // Calculate isDarkMode based on normalized theme
  const isDarkMode = React.useMemo(() => {
    return theme.colorScheme === 'dark';
  }, [theme]);

  const contextValue = React.useMemo<ThemeContextValue>(
    () => ({ theme, isDarkMode }),
    [theme, isDarkMode]
  );

  React.useEffect(() => {
    if (!themeRef.current) return;
    const el = themeRef.current;

    // Handle full theme object (always an object after normalization)
    const { colorScheme, radius, density, typography, color } = theme;
    const isDarkMode = colorScheme === 'dark';

    // Color scheme (light/dark)
    if (isDarkMode) {
      el.classList.add('dark');
    } else {
      el.classList.remove('dark');
    }

    // Radius
    if (radius) {
      el.dataset.radius = radius;
    }

    // Density - set CSS variables for spacing
    if (density) {
      el.dataset.density = density;
      const { spacing, padding, gap } = getDensitySpacing(density);
      el.style.setProperty('--density-spacing', String(spacing));
      el.style.setProperty('--density-padding', padding);
      el.style.setProperty('--density-gap', gap);
    }

    // Typography
    if (typography) {
      if (typography.baseSize) {
        document.documentElement.style.setProperty('font-size', `${typography.baseSize}px`);
      }
      if (typography.fontFamily) {
        el.style.setProperty('--font-family', typography.fontFamily);
        // Set on documentElement to override Tailwind's @theme
        document.documentElement.style.setProperty('--font-sans', typography.fontFamily);
        // Set Tailwind 4 default font variable
        document.documentElement.style.setProperty('--default-font-family', typography.fontFamily);
      }
      if (typography.fontFamilyMono) {
        el.style.setProperty('--font-family-mono', typography.fontFamilyMono);
        document.documentElement.style.setProperty('--font-mono', typography.fontFamilyMono);
        // Set Tailwind 4 default mono font variable
        document.documentElement.style.setProperty('--default-mono-font-family', typography.fontFamilyMono);
      }

      // Load custom fonts from fontSources (user-provided URLs only)
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

    // Colors - set on both element and documentElement for Tailwind compatibility
    if (color) {
      const root = document.documentElement;

      // Grayscale colors (affects muted, border, card, etc.)
      if (color.grayscale) {
        const grayscaleColors = generateGrayscaleColors(color.grayscale, isDarkMode);
        Object.entries(grayscaleColors).forEach(([key, value]) => {
          el.style.setProperty(`--${key}`, value);
          root.style.setProperty(`--${key}`, value);
        });
      }

      // Accent color with level adjustment
      if (color.accent?.primary) {
        // const level = color.accent.level ?? 2; // Default to level 2 (no adjustment)
        // const { primary, ring } = adjustAccentByLevel(color.accent.primary, level);
        const primary = color.accent?.primary

        el.style.setProperty('--primary', primary);
        el.style.setProperty('--accent', primary);
        // el.style.setProperty('--ring', ring);
        root.style.setProperty('--primary', primary);
        root.style.setProperty('--accent', primary);
        // root.style.setProperty('--ring', ring);

        // Calculate and set primary-foreground based on luminance
        const primaryLuminance = getLuminance(color.accent.primary);
        if (primaryLuminance > 0.5) {
          // Light primary color -> dark foreground text
          el.style.setProperty('--primary-foreground', 'oklch(0.145 0 0)');
          el.style.setProperty('--accent-foreground', 'oklch(0.145 0 0)');
          root.style.setProperty('--primary-foreground', 'oklch(0.145 0 0)');
          root.style.setProperty('--accent-foreground', 'oklch(0.145 0 0)');
        } else {
          // Dark primary color -> light foreground text
          el.style.setProperty('--primary-foreground', 'oklch(0.985 0 0)');
          el.style.setProperty('--accent-foreground', 'oklch(0.985 0 0)');
          root.style.setProperty('--primary-foreground', 'oklch(0.985 0 0)');
          root.style.setProperty('--accent-foreground', 'oklch(0.985 0 0)');
        }
      }

      // Surface colors
      if (color.surface?.background) {
        if (color.surface.background) {
          el.style.setProperty('--background', color.surface.background);
          root.style.setProperty('--background', color.surface.background);
        }

        // Auto-calculate chat-foreground based on background luminance
        // This ensures AI message text is always readable regardless of background
        const bgLuminance = getLuminance(color.surface.background);
        const chatForeground = bgLuminance > 0.5
          ? 'oklch(0.145 0 0)'  // Dark text for light backgrounds
          : 'oklch(0.985 0 0)'; // Light text for dark backgrounds
        el.style.setProperty('--chat-foreground', chatForeground);
        root.style.setProperty('--chat-foreground', chatForeground);
      }

      // Foreground color - apply directly without conditions
      if (color.surface?.foreground) {
        const oklchValue = hexToOklch(color.surface.foreground);
        if (oklchValue) {
          el.style.setProperty('--foreground', oklchValue);
          root.style.setProperty('--foreground', oklchValue);
        }
      }
    }

    // Cleanup function
    return () => {
      const root = document.documentElement;
      el.classList.remove('dark');
      el.removeAttribute('data-radius');
      el.removeAttribute('data-density');
      el.style.removeProperty('--density-spacing');
      el.style.removeProperty('--density-padding');
      el.style.removeProperty('--density-gap');
      root.style.removeProperty('font-size');
      el.style.removeProperty('--font-family');
      el.style.removeProperty('--font-family-mono');
      root.style.removeProperty('--font-sans');
      root.style.removeProperty('--font-mono');
      root.style.removeProperty('--default-font-family');
      root.style.removeProperty('--default-mono-font-family');
      // Color properties - remove from both el and root
      const colorProps = [
        '--primary', '--primary-foreground', '--accent', '--accent-foreground',
        '--ring', '--background', '--foreground', '--chat-foreground', '--muted', '--muted-foreground',
        '--border', '--card', '--card-foreground', '--popover', '--popover-foreground',
        '--secondary', '--secondary-foreground'
      ];
      colorProps.forEach(prop => {
        el.style.removeProperty(prop);
        root.style.removeProperty(prop);
      });
    };
  }, [theme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      <div
        ref={themeRef}
        className="h-full w-full bg-background text-foreground"
        style={{
          ...(theme.typography?.fontFamily && { fontFamily: theme.typography.fontFamily }),
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export default ThemeProvider;
