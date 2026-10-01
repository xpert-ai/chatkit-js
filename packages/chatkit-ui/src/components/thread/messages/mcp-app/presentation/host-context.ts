import { escapeHtmlAttribute, injectHeadContent } from '../sandbox/html';
import type { McpAppTheme, McpAppThemeMode } from '../types';

export function getContainerDimensions(element: HTMLElement | null) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
  };
}

export function normalizeHostLocale(locale?: string) {
  return locale?.trim() || navigator.language || 'en-US';
}

export function getLocaleLanguage(locale: string) {
  return locale.split(/[-_]/)[0]?.toLowerCase() || locale.toLowerCase();
}

export function getLocaleDirection(locale: string) {
  const language = getLocaleLanguage(locale);
  return ['ar', 'fa', 'he', 'ur'].includes(language) ? 'rtl' : 'ltr';
}

export function setHtmlAttribute(attrs: string, name: string, value: string) {
  const escaped = escapeHtmlAttribute(value);
  const pattern = new RegExp(`\\s${name}=("[^"]*"|'[^']*'|[^\\s>]*)`, 'i');
  if (pattern.test(attrs)) {
    return attrs.replace(pattern, ` ${name}="${escaped}"`);
  }
  return `${attrs} ${name}="${escaped}"`;
}

export function injectMcpAppLocale(html: string, locale: string) {
  const normalizedLocale = normalizeHostLocale(locale);
  const direction = getLocaleDirection(normalizedLocale);

  if (/<html[\s>]/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, (_match, attrs: string) => {
      const withLang = setHtmlAttribute(attrs, 'lang', normalizedLocale);
      const withDirection = setHtmlAttribute(withLang, 'dir', direction);
      return `<html${withDirection}>`;
    });
  }

  return `<!doctype html><html lang="${escapeHtmlAttribute(
    normalizedLocale,
  )}" dir="${direction}"><head></head><body>${html}</body></html>`;
}

export const MCP_APP_THEME_COLOR_TOKENS = [
  ['--background', '--mcp-app-color-background', 'oklch(1 0 0)'],
  ['--foreground', '--mcp-app-color-foreground', 'oklch(0.145 0 0)'],
  ['--card', '--mcp-app-color-card', 'oklch(1 0 0)'],
  ['--card-foreground', '--mcp-app-color-card-foreground', 'oklch(0.145 0 0)'],
  ['--popover', '--mcp-app-color-popover', 'oklch(1 0 0)'],
  [
    '--popover-foreground',
    '--mcp-app-color-popover-foreground',
    'oklch(0.145 0 0)',
  ],
  ['--primary', '--mcp-app-color-primary', 'oklch(0.205 0 0)'],
  [
    '--primary-foreground',
    '--mcp-app-color-primary-foreground',
    'oklch(0.985 0 0)',
  ],
  ['--secondary', '--mcp-app-color-secondary', 'oklch(0.97 0 0)'],
  [
    '--secondary-foreground',
    '--mcp-app-color-secondary-foreground',
    'oklch(0.205 0 0)',
  ],
  ['--muted', '--mcp-app-color-muted', 'oklch(0.97 0 0)'],
  [
    '--muted-foreground',
    '--mcp-app-color-muted-foreground',
    'oklch(0.556 0 0)',
  ],
  ['--accent', '--mcp-app-color-accent', 'oklch(0.97 0 0)'],
  [
    '--accent-foreground',
    '--mcp-app-color-accent-foreground',
    'oklch(0.205 0 0)',
  ],
  ['--destructive', '--mcp-app-color-destructive', 'oklch(0.577 0.245 27.325)'],
  [
    '--destructive-foreground',
    '--mcp-app-color-destructive-foreground',
    'oklch(0.985 0 0)',
  ],
  ['--border', '--mcp-app-color-border', 'oklch(0.922 0 0)'],
  ['--input', '--mcp-app-color-input', 'oklch(0.922 0 0)'],
  ['--ring', '--mcp-app-color-ring', 'oklch(0.708 0 0)'],
  ['--chart-1', '--mcp-app-color-chart-1', 'oklch(0.87 0 0)'],
  ['--chart-2', '--mcp-app-color-chart-2', 'oklch(0.556 0 0)'],
  ['--chart-3', '--mcp-app-color-chart-3', 'oklch(0.439 0 0)'],
  ['--chart-4', '--mcp-app-color-chart-4', 'oklch(0.371 0 0)'],
  ['--chart-5', '--mcp-app-color-chart-5', 'oklch(0.269 0 0)'],
] as const;

export function sanitizeCssValue(value: string) {
  return value.replace(/[;{}<>]/g, '').trim();
}

export function normalizeColorCssValue(value: string) {
  const trimmed = sanitizeCssValue(value);
  if (!trimmed) return '';

  if (
    /^(#|rgb\(|rgba\(|hsl\(|hsla\(|oklch\(|oklab\(|color\(|var\()/i.test(
      trimmed,
    )
  ) {
    return trimmed;
  }

  if (/^-?\d/.test(trimmed) && /\s/.test(trimmed)) {
    return `hsl(${trimmed})`;
  }

  return trimmed;
}

export function getHostThemeMode(): McpAppThemeMode {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function readHostCssVariable(
  element: HTMLElement | null,
  variableName: string,
) {
  const candidates = [
    element,
    element === document.documentElement ? null : document.documentElement,
  ].filter(Boolean) as HTMLElement[];

  for (const candidate of candidates) {
    const value = window
      .getComputedStyle(candidate)
      .getPropertyValue(variableName)
      .trim();
    if (value) {
      return value;
    }
  }

  return '';
}

export function buildMcpAppTheme(element: HTMLElement | null): McpAppTheme {
  const source = element ?? document.documentElement;
  const sourceStyles = window.getComputedStyle(source);
  const cssVariables: Record<string, string> = {
    '--mcp-app-color-scheme': getHostThemeMode(),
    '--mcp-app-font-sans': sanitizeCssValue(
      sourceStyles.fontFamily || 'ui-sans-serif, system-ui, sans-serif',
    ),
    '--mcp-app-font-mono': sanitizeCssValue(
      readHostCssVariable(source, '--font-mono') ||
        'ui-monospace, SFMono-Regular, Menlo, monospace',
    ),
    '--mcp-app-radius': sanitizeCssValue(
      readHostCssVariable(source, '--radius') || '0.5rem',
    ),
  };

  for (const [
    hostVariable,
    appVariable,
    fallback,
  ] of MCP_APP_THEME_COLOR_TOKENS) {
    cssVariables[appVariable] =
      normalizeColorCssValue(readHostCssVariable(source, hostVariable)) ||
      fallback;
  }

  return {
    mode: getHostThemeMode(),
    cssVariables,
  };
}

export function injectMcpAppTheme(html: string, theme: McpAppTheme) {
  const declarations = Object.entries(theme.cssVariables)
    .map(([name, value]) => `${name}: ${sanitizeCssValue(value)};`)
    .join('');
  const style = `<style id="mcp-app-host-theme">:root{font-size:14px;color-scheme:${theme.mode};${declarations}}</style>`;

  return injectHeadContent(html, style);
}
