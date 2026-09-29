/** Standard MCP Apps style keys; legacy injected CSS variables remain separate. */
export function standardMcpAppStyles(legacy: Record<string, string>) {
  const mapping = {
    '--font-sans': '--mcp-app-font-sans',
    '--font-mono': '--mcp-app-font-mono',
    '--border-radius-md': '--mcp-app-radius',
    '--color-background-primary': '--mcp-app-color-background',
    '--color-background-secondary': '--mcp-app-color-card',
    '--color-background-tertiary': '--mcp-app-color-muted',
    '--color-background-inverse': '--mcp-app-color-primary',
    '--color-text-primary': '--mcp-app-color-foreground',
    '--color-text-secondary': '--mcp-app-color-muted-foreground',
    '--color-text-inverse': '--mcp-app-color-primary-foreground',
    '--color-text-danger': '--mcp-app-color-destructive',
    '--color-border-primary': '--mcp-app-color-border',
    '--color-ring-primary': '--mcp-app-color-ring',
  };
  return Object.fromEntries(Object.entries(mapping)
    .filter(([, source]) => legacy[source])
    .map(([key, source]) => [key, legacy[source]]));
}
