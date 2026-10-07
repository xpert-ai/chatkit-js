import { afterEach, describe, expect, it } from 'vitest';
import { standardMcpAppStyles } from './theme';
import {
  buildMcpAppTheme,
  injectMcpAppTheme,
} from './presentation/host-context';

describe('MCP Apps standard styles', () => {
  afterEach(() => document.documentElement.removeAttribute('style'));

  it.each([14, 16, 20])(
    'passes a %ipx host root size across the iframe boundary',
    (size) => {
      document.documentElement.style.fontSize = `${size}px`;
      const theme = buildMcpAppTheme(document.body);
      expect(theme.cssVariables['--mcp-app-font-size']).toBe(`${size}px`);
      expect(
        standardMcpAppStyles(theme.cssVariables)['--font-text-md-size'],
      ).toBe(`${size}px`);
      expect(
        injectMcpAppTheme('<html><head></head><body></body></html>', theme),
      ).toContain('font-size:var(--mcp-app-font-size,16px)');
    },
  );

  it('reads the new root size after a theme change rather than retaining the initial size', () => {
    document.documentElement.style.fontSize = '16px';
    expect(
      buildMcpAppTheme(document.body).cssVariables['--mcp-app-font-size'],
    ).toBe('16px');
    document.documentElement.style.fontSize = '20px';
    expect(
      buildMcpAppTheme(document.body).cssVariables['--mcp-app-font-size'],
    ).toBe('20px');
  });
  it('maps legacy CSS into standard SDK keys without custom protocol keys', () => {
    expect(
      standardMcpAppStyles({
        '--mcp-app-color-background': '#fff',
        '--mcp-app-font-sans': 'sans-serif',
        '--mcp-app-color-scheme': 'light',
        '--mcp-app-color-chart-1': '#00f',
      }),
    ).toEqual({
      '--color-background-primary': '#fff',
      '--font-sans': 'sans-serif',
    });
  });
});
