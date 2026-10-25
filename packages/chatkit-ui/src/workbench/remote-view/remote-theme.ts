import { getThemeRadii } from '../../lib/theme-surfaces';

type RemoteTheme = {
  mode: 'light' | 'dark';
  tokens: Record<string, string>;
};

export function createRemoteTheme(
  element: HTMLElement,
  isDarkMode: boolean,
  radiusPreset: Parameters<typeof getThemeRadii>[0],
): RemoteTheme {
  const style = getComputedStyle(element);
  const bodyStyle = getComputedStyle(document.body);
  const mode = isDarkMode ? 'dark' : 'light';
  const background = readThemeColor(
    style,
    '--background',
    isDarkMode ? '#16181c' : '#ffffff',
  );
  const foreground = readThemeColor(
    style,
    '--foreground',
    isDarkMode ? '#e3e3e3' : '#18181b',
  );
  const card = readThemeColor(style, '--card', background);
  const cardForeground = readThemeColor(style, '--card-foreground', foreground);
  const popover = readThemeColor(style, '--popover', card);
  const popoverForeground = readThemeColor(
    style,
    '--popover-foreground',
    cardForeground,
  );
  const muted = readThemeColor(
    style,
    '--muted',
    isDarkMode ? '#26272b' : '#f4f4f5',
  );
  const mutedForeground = readThemeColor(
    style,
    '--muted-foreground',
    isDarkMode ? '#a3a3a3' : '#71717a',
  );
  const secondary = readThemeColor(style, '--secondary', muted);
  const secondaryForeground = readThemeColor(
    style,
    '--secondary-foreground',
    foreground,
  );
  const accent = readThemeColor(style, '--accent', muted);
  const accentForeground = readThemeColor(
    style,
    '--accent-foreground',
    foreground,
  );
  const primary = readThemeColor(
    style,
    '--primary',
    isDarkMode ? '#3b82f6' : '#18181b',
  );
  const primaryForeground = readThemeColor(
    style,
    '--primary-foreground',
    '#ffffff',
  );
  const destructive = readThemeColor(
    style,
    '--destructive',
    isDarkMode ? '#f87171' : '#dc2626',
  );
  const success = readThemeColor(style, '--success', '#047857');
  // Share ChatKit's preset scale, resolving the base in the host so no host-only
  // CSS variable references cross the isolated document boundary.
  const radius = getThemeRadii(
    radiusPreset,
    readThemeValue(style, '--radius', '0.625rem'),
  );

  return {
    mode,
    tokens: {
      fontFamily:
        readThemeValue(style, '--font-sans') ||
        bodyStyle.fontFamily ||
        'Inter, ui-sans-serif, system-ui, sans-serif',
      colorBackground: background,
      colorForeground: foreground,
      colorCard: card,
      colorCardForeground: cardForeground,
      colorPopover: popover,
      colorPopoverForeground: popoverForeground,
      colorSecondary: secondary,
      colorSecondaryForeground: secondaryForeground,
      colorMuted: muted,
      colorMutedForeground: mutedForeground,
      colorAccent: accent,
      colorAccentForeground: accentForeground,
      colorBorder: readThemeColor(
        style,
        '--border',
        isDarkMode ? '#27272a' : '#e4e4e7',
      ),
      colorInput: readThemeColor(
        style,
        '--input',
        isDarkMode ? '#52525b' : '#d4d4d8',
      ),
      colorPrimary: primary,
      colorPrimaryForeground: primaryForeground,
      colorDestructive: destructive,
      colorDestructiveForeground: readThemeColor(
        style,
        '--destructive-foreground',
        primaryForeground,
      ),
      colorDestructiveBackground: isDarkMode
        ? 'color-mix(in srgb, var(--xui-color-destructive) 18%, var(--xui-color-background))'
        : 'color-mix(in srgb, var(--xui-color-destructive) 9%, var(--xui-color-background))',
      colorSuccess: success,
      colorSuccessBackground: isDarkMode
        ? 'color-mix(in srgb, var(--xui-color-success) 18%, var(--xui-color-background))'
        : 'color-mix(in srgb, var(--xui-color-success) 9%, var(--xui-color-background))',
      colorWarning: readThemeColor(style, '--warning', primary),
      colorInfo: readThemeColor(style, '--info', primary),
      colorRing: readThemeColor(style, '--ring', primary),
      colorChart1: readThemeColor(style, '--chart-1', primary),
      colorChart2: readThemeColor(style, '--chart-2', success),
      colorChart3: readThemeColor(style, '--chart-3', primary),
      colorChart4: readThemeColor(style, '--chart-4', destructive),
      colorChart5: readThemeColor(style, '--chart-5', accentForeground),
      // rem values inside the isolated view must use the host document root size.
      densityRootFontSize:
        getComputedStyle(document.documentElement).fontSize || '16px',
      radiusSm:
        radiusPreset === 'sharp'
          ? '0px'
          : `max(0px, calc(${radius.item} - 2px))`,
      radiusMd: radius.item,
      radiusLg: radius.panel,
      fontSizeXs: readThemeValue(
        style,
        '--workbench-extension-font-size-xs',
        '0.75rem',
      ),
      fontSizeSm: readThemeValue(
        style,
        '--workbench-extension-font-size-sm',
        '0.8125rem',
      ),
      fontSizeMd: readThemeValue(
        style,
        '--workbench-extension-font-size-md',
        '0.875rem',
      ),
      fontSizeLg: readThemeValue(
        style,
        '--workbench-extension-font-size-lg',
        '1rem',
      ),
      fontSizeControl: readThemeValue(
        style,
        '--workbench-extension-font-size-control',
        '0.8125rem',
      ),
      fontSizeButton: readThemeValue(
        style,
        '--workbench-extension-font-size-button',
        '0.8125rem',
      ),
      fontSizeTable: readThemeValue(
        style,
        '--workbench-extension-font-size-table',
        '0.8125rem',
      ),
      controlHeight: readThemeValue(
        style,
        '--workbench-extension-control-height',
        '2rem',
      ),
      buttonHeight: readThemeValue(
        style,
        '--workbench-extension-button-height',
        '2rem',
      ),
      buttonHeightSm: readThemeValue(
        style,
        '--workbench-extension-button-height-sm',
        '1.75rem',
      ),
    },
  };
}

function readThemeValue(
  style: CSSStyleDeclaration,
  name: string,
  fallback = '',
) {
  return style.getPropertyValue(name).trim() || fallback;
}

function readThemeColor(
  style: CSSStyleDeclaration,
  name: string,
  fallback: string,
) {
  const value = readThemeValue(style, name);
  if (!value) return fallback;
  const resolved = resolveCssVariable(style, value);
  if (/^(#|rgb|hsl|oklch|color-mix)/i.test(resolved)) return resolved;
  return `hsl(${resolved})`;
}

function resolveCssVariable(
  style: CSSStyleDeclaration,
  value: string,
  depth = 0,
): string {
  if (depth > 4 || !value.startsWith('var(')) return value;
  const match = /^var\(\s*(--[^,\s)]+)\s*(?:,\s*(.+))?\)$/.exec(value);
  if (!match) return value;
  const variableName = match[1];
  if (!variableName) return value;
  const resolved =
    style.getPropertyValue(variableName).trim() || match[2]?.trim() || '';
  return resolved ? resolveCssVariable(style, resolved, depth + 1) : value;
}
