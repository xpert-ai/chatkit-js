import * as React from 'react';

import {
  resolveLocalizedText,
  type TMessageComponentMcpAppData,
} from '@xpert-ai/chatkit-types';
import { AlertCircle, Loader2 } from 'lucide-react';

import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { cn } from '../../../lib/utils';
import { useStreamContext } from '../../../providers/Stream';
import { Badge } from '../../ui/badge';
import { IconDefinitionRenderer } from '../../ui/icon-definition';

type JsonRpcRequest = {
  jsonrpc?: '2.0';
  id?: string | number | null;
  method?: string;
  params?: unknown;
};

type McpAppResourceResponse = {
  uri?: string;
  mimeType?: string;
  text?: string;
  blob?: string;
  resourceUri?: string;
  title?: TMessageComponentMcpAppData['title'];
  description?: TMessageComponentMcpAppData['description'];
  icon?: TMessageComponentMcpAppData['icon'];
  csp?: TMessageComponentMcpAppData['csp'];
  permissions?: TMessageComponentMcpAppData['permissions'];
  domain?: string;
  prefersBorder?: boolean;
  toolInfo?: Record<string, unknown>;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildXpertApiUrl(apiUrl: string, path: string) {
  const normalizedApiUrl = apiUrl.trim();
  if (!normalizedApiUrl) return path;

  try {
    const url = new URL(normalizedApiUrl);
    return `${url.origin}${path}`;
  } catch {
    return path;
  }
}

function appendQuery(path: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function buildMcpAppReviveParams(data: TMessageComponentMcpAppData) {
  const params = new URLSearchParams();
  const add = (key: string, value?: string) => {
    if (value) {
      params.set(key, value);
    }
  };

  add('toolsetId', data.toolsetId);
  add('serverName', data.serverName);
  add('toolName', data.toolName);
  add('toolCallId', data.toolCallId);
  add('resourceUri', data.resourceUri);
  add('title', typeof data.title === 'string' ? data.title : undefined);
  add('token', data.appInstanceToken);

  return params;
}

function buildMcpAppEndpointPath(
  data: TMessageComponentMcpAppData,
  endpoint: 'resource' | 'rpc',
) {
  return appendQuery(
    `/api/xpert-toolset/mcp-apps/${encodeURIComponent(
      data.appInstanceId,
    )}/${endpoint}`,
    buildMcpAppReviveParams(data),
  );
}

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function domains(values?: string[]) {
  return values?.filter((value) => value.trim()).join(' ') ?? '';
}

function buildCsp(csp?: TMessageComponentMcpAppData['csp']) {
  const resourceDomains = domains(csp?.resourceDomains);
  const connectDomains = domains(csp?.connectDomains) || "'none'";
  const frameDomains = domains(csp?.frameDomains) || "'none'";
  const baseUriDomains = domains(csp?.baseUriDomains) || "'self'";

  return [
    "default-src 'none'",
    `script-src 'unsafe-inline' ${resourceDomains}`.trim(),
    `style-src 'unsafe-inline' ${resourceDomains}`.trim(),
    `img-src data: blob: ${resourceDomains}`.trim(),
    `media-src data: blob: ${resourceDomains}`.trim(),
    `font-src data: ${resourceDomains}`.trim(),
    `connect-src ${connectDomains}`,
    `frame-src ${frameDomains}`,
    `base-uri ${baseUriDomains}`,
  ].join('; ');
}

function injectHeadContent(html: string, content: string) {
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${content}`);
  }

  return `<!doctype html><html><head>${content}</head><body>${html}</body></html>`;
}

function injectCsp(html: string, csp?: TMessageComponentMcpAppData['csp']) {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttribute(
    buildCsp(csp),
  )}">`;

  return injectHeadContent(html, meta);
}

function decodeResourceHtml(resource: McpAppResourceResponse) {
  if (typeof resource.text === 'string') {
    return resource.text;
  }

  if (typeof resource.blob !== 'string') {
    return null;
  }

  try {
    const decoded = window.atob(resource.blob);
    const escaped = Array.from(decoded)
      .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join('');
    return decodeURIComponent(escaped);
  } catch {
    try {
      return window.atob(resource.blob);
    } catch {
      return null;
    }
  }
}

function normalizeJsonRpcMessage(value: unknown): JsonRpcRequest | null {
  const data =
    typeof value === 'string'
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return null;
          }
        })()
      : value;

  if (!isRecord(data) || typeof data.method !== 'string') {
    return null;
  }

  return data as JsonRpcRequest;
}

function jsonRpcResult(id: JsonRpcRequest['id'], result: unknown) {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    result,
  };
}

function jsonRpcError(id: JsonRpcRequest['id'], message: string) {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: {
      code: -32000,
      message,
    },
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getContainerDimensions(element: HTMLElement | null) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
  };
}

function normalizeHostLocale(locale?: string) {
  return locale?.trim() || navigator.language || 'en-US';
}

function getLocaleLanguage(locale: string) {
  return locale.split(/[-_]/)[0]?.toLowerCase() || locale.toLowerCase();
}

function getLocaleDirection(locale: string) {
  const language = getLocaleLanguage(locale);
  return ['ar', 'fa', 'he', 'ur'].includes(language) ? 'rtl' : 'ltr';
}

function setHtmlAttribute(attrs: string, name: string, value: string) {
  const escaped = escapeHtmlAttribute(value);
  const pattern = new RegExp(`\\s${name}=("[^"]*"|'[^']*'|[^\\s>]*)`, 'i');
  if (pattern.test(attrs)) {
    return attrs.replace(pattern, ` ${name}="${escaped}"`);
  }
  return `${attrs} ${name}="${escaped}"`;
}

function injectMcpAppLocale(html: string, locale: string) {
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

type McpAppThemeMode = 'light' | 'dark';

type McpAppTheme = {
  mode: McpAppThemeMode;
  cssVariables: Record<string, string>;
};

const MCP_APP_THEME_COLOR_TOKENS = [
  ['--background', '--mcp-app-color-background', 'oklch(1 0 0)'],
  ['--foreground', '--mcp-app-color-foreground', 'oklch(0.145 0 0)'],
  ['--card', '--mcp-app-color-card', 'oklch(1 0 0)'],
  [
    '--card-foreground',
    '--mcp-app-color-card-foreground',
    'oklch(0.145 0 0)',
  ],
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
  [
    '--destructive',
    '--mcp-app-color-destructive',
    'oklch(0.577 0.245 27.325)',
  ],
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

function sanitizeCssValue(value: string) {
  return value.replace(/[;{}<>]/g, '').trim();
}

function normalizeColorCssValue(value: string) {
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

function getHostThemeMode(): McpAppThemeMode {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function readHostCssVariable(
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

function buildMcpAppTheme(element: HTMLElement | null): McpAppTheme {
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

function injectMcpAppTheme(html: string, theme: McpAppTheme) {
  const declarations = Object.entries(theme.cssVariables)
    .map(([name, value]) => `${name}: ${sanitizeCssValue(value)};`)
    .join('');
  const style = `<style id="mcp-app-host-theme">:root{color-scheme:${theme.mode};${declarations}}</style>`;

  return injectHeadContent(html, style);
}

function buildStandardToolInfo(
  data: TMessageComponentMcpAppData,
  resource?: McpAppResourceResponse | null,
) {
  const raw = resource?.toolInfo ?? {};
  const rawTitle =
    isRecord(raw) && (raw.title !== undefined || raw.name !== undefined)
      ? (raw.title ?? raw.name)
      : undefined;
  const rawDescription =
    isRecord(raw) && raw.description !== undefined
      ? raw.description
      : undefined;
  const rawIcon =
    isRecord(raw) && raw.icon !== undefined ? raw.icon : undefined;
  const originalName =
    isRecord(raw) && typeof raw.originalName === 'string'
      ? raw.originalName
      : data.toolName;
  const title = rawTitle ?? resource?.title ?? data.title ?? data.toolName;
  const description = rawDescription ?? resource?.description ?? data.description;
  const icon = rawIcon ?? resource?.icon ?? data.icon;

  return {
    ...raw,
    id: data.toolCallId,
    tool: {
      name: originalName,
      title,
      ...(description ? { description } : {}),
      ...(icon ? { icon } : {}),
    },
  };
}

function hasPermissionGrant(value: unknown) {
  return value === true || isRecord(value);
}

function buildIframeAllow(
  permissions?: TMessageComponentMcpAppData['permissions'],
) {
  if (!permissions) return undefined;

  const policies: string[] = [];
  if (hasPermissionGrant(permissions.camera)) {
    policies.push('camera *');
  }
  if (hasPermissionGrant(permissions.microphone)) {
    policies.push('microphone *');
  }
  if (hasPermissionGrant(permissions.geolocation)) {
    policies.push('geolocation *');
  }
  if (hasPermissionGrant(permissions.clipboardWrite)) {
    policies.push('clipboard-write *');
  }

  return policies.length ? policies.join('; ') : undefined;
}

function buildSandboxAttribute() {
  return ['allow-downloads', 'allow-forms', 'allow-modals', 'allow-scripts'].join(
    ' ',
  );
}

function stringifyToolResult(value: unknown) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return String(value);
  }
}

function normalizeCallToolResult(value: unknown) {
  if (isRecord(value) && Array.isArray(value.content)) {
    return value;
  }

  if (Array.isArray(value) && value.length >= 2) {
    const [content, artifact] = value;
    const text =
      typeof content === 'string' ? content : stringifyToolResult(content);
    const normalized: Record<string, unknown> = {
      content: [
        {
          type: 'text',
          text,
        },
      ],
    };

    if (isRecord(artifact)) {
      normalized._meta = artifact;
      if (isRecord(artifact.structuredContent)) {
        normalized.structuredContent = artifact.structuredContent;
      }
    } else if (Array.isArray(artifact)) {
      const structured = artifact.find(
        (item): item is Record<string, unknown> =>
          isRecord(item) && isRecord(item.structuredContent),
      );
      const meta = artifact.find(isRecord);
      if (structured?.structuredContent) {
        normalized.structuredContent = structured.structuredContent;
      }
      if (meta) {
        normalized._meta = meta;
      }
    }

    return normalized;
  }

  return {
    content: [
      {
        type: 'text',
        text: stringifyToolResult(value),
      },
    ],
  };
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function contentBlocksToText(content: unknown) {
  if (!Array.isArray(content)) return null;

  const parts = content
    .map((item) => {
      if (!isRecord(item)) return '';
      if (item.type === 'text' && typeof item.text === 'string') {
        return item.text;
      }
      if (item.type === 'resource_link' && typeof item.uri === 'string') {
        return item.uri;
      }
      if (item.type === 'image' || item.type === 'audio') {
        return `[${item.type}]`;
      }
      return stringifyToolResult(item);
    })
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length ? parts.join('\n\n') : null;
}

export function isMcpAppComponentData(
  data: unknown,
): data is TMessageComponentMcpAppData {
  return (
    isRecord(data) &&
    data.type === 'McpApp' &&
    typeof data.appInstanceId === 'string' &&
    typeof data.resourceUri === 'string'
  );
}

export function McpAppMessage({
  data,
  className,
}: {
  data: TMessageComponentMcpAppData;
  className?: string;
}) {
  const { i18n } = useChatkitTranslation();
  const {
    apiUrl,
    authenticatedFetch,
    isLoading: streamIsLoading,
    submit,
  } = useStreamContext();
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const initializedRef = React.useRef(false);
  const sentInitialResultRef = React.useRef(false);
  const modelContextRef = React.useRef<unknown>(null);
  const [resource, setResource] = React.useState<McpAppResourceResponse | null>(
    null,
  );
  const [srcDoc, setSrcDoc] = React.useState<string | null>(null);
  const [height, setHeight] = React.useState(420);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const resourceUrl = React.useMemo(
    () =>
      buildXpertApiUrl(
        apiUrl,
        buildMcpAppEndpointPath(data, 'resource'),
      ),
    [apiUrl, data],
  );

  const rpcUrl = React.useMemo(
    () =>
      buildXpertApiUrl(
        apiUrl,
        buildMcpAppEndpointPath(data, 'rpc'),
      ),
    [apiUrl, data],
  );

  const postToApp = React.useCallback((message: unknown) => {
    iframeRef.current?.contentWindow?.postMessage(message, '*');
  }, []);

  const callHostRpc = React.useCallback(
    async (request: JsonRpcRequest) => {
      const response = await authenticatedFetch(rpcUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: request.id ?? null,
          method: request.method,
          params: request.params,
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP App RPC failed with ${response.status}`);
      }

      return response.json() as Promise<unknown>;
    },
    [authenticatedFetch, rpcUrl],
  );

  const sendInitialToolNotifications = React.useCallback(() => {
    if (!initializedRef.current || sentInitialResultRef.current || !resource) {
      return;
    }

    sentInitialResultRef.current = true;
    postToApp({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-input',
      params: {
        arguments: resource.toolInput ?? data.toolInput ?? {},
      },
    });
    postToApp({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: {
        ...normalizeCallToolResult(resource.toolResult),
        toolCallId: data.toolCallId,
        toolName: data.toolName,
        // Legacy compatibility for apps written before the 2026-01-26 notification shape.
        result: resource.toolResult,
      },
    });
  }, [data.toolCallId, data.toolInput, data.toolName, postToApp, resource]);

  React.useEffect(() => {
    const controller = new AbortController();
    initializedRef.current = false;
    sentInitialResultRef.current = false;
    setIsLoading(true);
    setError(null);
    setResource(null);
    setSrcDoc(null);

    void (async () => {
      try {
        const response = await authenticatedFetch(resourceUrl, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`MCP App resource failed with ${response.status}`);
        }

        const payload = (await response.json()) as McpAppResourceResponse;
        const html = decodeResourceHtml(payload);
        if (!html) {
          throw new Error('MCP App resource did not include HTML content');
        }

        setResource(payload);
        const hostLocale = normalizeHostLocale(i18n.language);
        setSrcDoc(
          injectMcpAppTheme(
            injectCsp(
              injectMcpAppLocale(html, hostLocale),
              payload.csp ?? data.csp,
            ),
            buildMcpAppTheme(containerRef.current),
          ),
        );
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [
    authenticatedFetch,
    data.appInstanceId,
    data.csp,
    i18n.language,
    resourceUrl,
  ]);

  React.useEffect(() => {
    sendInitialToolNotifications();
  }, [sendInitialToolNotifications]);

  React.useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const request = normalizeJsonRpcMessage(event.data);
      if (!request?.method) {
        return;
      }

      if (request.method === 'ui/notifications/initialized') {
        initializedRef.current = true;
        sendInitialToolNotifications();
        return;
      }

      if (request.method === 'ui/notifications/size-changed') {
        const nextHeight =
          isRecord(request.params) && typeof request.params.height === 'number'
            ? request.params.height
            : null;
        if (nextHeight !== null) {
          setHeight(Math.min(900, Math.max(240, Math.round(nextHeight))));
        }
        return;
      }

      if (request.method === 'ui/initialize') {
        initializedRef.current = true;
        const permissions = resource?.permissions ?? data.permissions;
        const csp = resource?.csp ?? data.csp;
        const toolInfo = buildStandardToolInfo(data, resource);
        const theme = buildMcpAppTheme(containerRef.current);
        const hostLocale = normalizeHostLocale(i18n.language);
        const hostLanguage = getLocaleLanguage(hostLocale);
        const hostDirection = getLocaleDirection(hostLocale);
        postToApp(
          jsonRpcResult(request.id, {
            protocolVersion: '2026-01-26',
            hostInfo: {
              name: 'xpert-chatkit',
              version: '1.0.0',
              title: 'Xpert ChatKit',
            },
            hostCapabilities: {
              serverTools: {},
              serverResources: {},
              openLinks: {},
              logging: {},
              message: {
                text: {},
              },
              updateModelContext: {
                text: {},
                structuredContent: {},
              },
              sandbox: {
                ...(permissions ? { permissions } : {}),
                ...(csp ? { csp } : {}),
              },
            },
            hostContext: {
              toolInfo,
              theme: theme.mode,
              themeCssVariables: theme.cssVariables,
              locale: hostLocale,
              language: hostLanguage,
              direction: hostDirection,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              displayMode: 'inline',
              availableDisplayModes: ['inline'],
              containerDimensions: getContainerDimensions(containerRef.current),
              userAgent: 'xpert-chatkit',
              platform: 'web',
              deviceCapabilities: {
                touch: navigator.maxTouchPoints > 0,
                hover: window.matchMedia('(hover: hover)').matches,
              },
            },
            // Legacy compatibility for apps written before the 2026-01-26 result shape.
            capabilities: {
              displayModes: ['inline'],
              serverTools: true,
              serverResources: true,
              openLinks: true,
            },
            context: {
              toolInfo: resource?.toolInfo ?? {
                name: data.toolName,
                toolCallId: data.toolCallId,
              },
              theme: theme.mode,
              themeCssVariables: theme.cssVariables,
              locale: hostLocale,
              language: hostLanguage,
              direction: hostDirection,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              displayMode: 'inline',
              availableDisplayModes: ['inline'],
              containerDimensions: getContainerDimensions(containerRef.current),
              userAgent: navigator.userAgent,
              platform: navigator.platform,
            },
          }),
        );
        sendInitialToolNotifications();
        return;
      }

      if (request.method === 'ui/open-link') {
        const href =
          isRecord(request.params) && typeof request.params.url === 'string'
            ? request.params.url
            : isRecord(request.params) && typeof request.params.href === 'string'
              ? request.params.href
              : null;
        if (href && isHttpUrl(href)) {
          window.open(href, '_blank', 'noopener,noreferrer');
          if (request.id !== undefined) {
            postToApp(jsonRpcResult(request.id, {}));
          }
        } else if (request.id !== undefined) {
          postToApp(jsonRpcResult(request.id, { isError: true }));
        }
        return;
      }

      if (request.method === 'ui/update-model-context') {
        modelContextRef.current = request.params;
        try {
          postToApp(await callHostRpc(request));
        } catch (rpcError) {
          postToApp(jsonRpcError(request.id, getErrorMessage(rpcError)));
        }
        return;
      }

      if (request.method === 'ui/message') {
        try {
          if (
            !isRecord(request.params) ||
            request.params.role !== 'user' ||
            !Array.isArray(request.params.content)
          ) {
            throw new Error(
              'ui/message params must include role "user" and content blocks',
            );
          }

          const hostResponse = await callHostRpc(request);
          if (isRecord(hostResponse) && hostResponse.error) {
            postToApp(hostResponse);
            return;
          }

          const inputText = contentBlocksToText(request.params.content);
          if (!inputText) {
            throw new Error('ui/message content did not include text');
          }

          await submit(
            {
              input: {
                input: inputText,
              },
            },
            {
              ...(streamIsLoading ? { followUpMode: 'queue' as const } : {}),
              context: {
                mcpApp: {
                  appInstanceId: data.appInstanceId,
                  resourceUri: data.resourceUri,
                  toolName: data.toolName,
                  toolCallId: data.toolCallId,
                  modelContext: modelContextRef.current,
                },
              },
            },
          );

          postToApp(hostResponse);
        } catch (messageError) {
          postToApp(jsonRpcError(request.id, getErrorMessage(messageError)));
        }
        return;
      }

      if (request.id === undefined && request.method.startsWith('ui/')) {
        return;
      }

      try {
        postToApp(await callHostRpc(request));
      } catch (rpcError) {
        postToApp(jsonRpcError(request.id, getErrorMessage(rpcError)));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [
    callHostRpc,
    data.appInstanceId,
    data.csp,
    data.permissions,
    data.resourceUri,
    data.title,
    data.toolCallId,
    data.toolName,
    i18n.language,
    postToApp,
    resource?.csp,
    resource?.permissions,
    resource?.toolInfo,
    sendInitialToolNotifications,
    streamIsLoading,
    submit,
  ]);

  const iframePermissions = resource?.permissions ?? data.permissions;
  const iframeAllow = React.useMemo(
    () => buildIframeAllow(iframePermissions),
    [iframePermissions],
  );
  const sandbox = React.useMemo(() => buildSandboxAttribute(), []);
  const prefersBorder =
    resource?.prefersBorder ?? data.prefersBorder ?? true;
  const displayTitle =
    resolveLocalizedText(resource?.title ?? data.title, i18n.language) ??
    data.toolName;
  const displayDescription = resolveLocalizedText(
    resource?.description ?? data.description,
    i18n.language,
  );
  const displayIcon = resource?.icon ?? data.icon;

  return (
    <div
      ref={containerRef}
      className={cn(
        'overflow-hidden rounded-lg border bg-background shadow-sm',
        !prefersBorder && 'border-transparent shadow-none',
        className,
      )}
    >
      <div className="flex min-h-10 items-center justify-between gap-3 border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {displayIcon ? (
            <IconDefinitionRenderer
              icon={displayIcon}
              size={18}
              className="shrink-0"
              decorative
            />
          ) : null}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{displayTitle}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {displayDescription ?? data.resourceUri}
            </div>
          </div>
        </div>
        <Badge variant="secondary" className="shrink-0 rounded-md">
          MCP App
        </Badge>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading MCP App</span>
        </div>
      ) : error ? (
        <div className="flex h-40 items-center justify-center gap-2 px-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
        </div>
      ) : srcDoc ? (
        <iframe
          ref={iframeRef}
          title={displayTitle}
          srcDoc={srcDoc}
          className="block w-full bg-background"
          style={{ height }}
          sandbox={sandbox}
          allow={iframeAllow}
          referrerPolicy="no-referrer"
        />
      ) : null}
    </div>
  );
}
