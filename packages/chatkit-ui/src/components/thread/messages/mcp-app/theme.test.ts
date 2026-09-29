import { describe, expect, it } from 'vitest';
import { standardMcpAppStyles } from './theme';

describe('MCP Apps standard styles', () => {
  it('maps legacy CSS into standard SDK keys without custom protocol keys', () => {
    expect(standardMcpAppStyles({ '--mcp-app-color-background': '#fff',
      '--mcp-app-font-sans': 'sans-serif', '--mcp-app-color-scheme': 'light',
      '--mcp-app-color-chart-1': '#00f' })).toEqual({
      '--color-background-primary': '#fff', '--font-sans': 'sans-serif',
    });
  });
});
