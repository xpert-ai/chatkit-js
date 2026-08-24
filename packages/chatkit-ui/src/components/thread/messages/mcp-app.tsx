import * as React from 'react';

import {
  resolveLocalizedText,
  type ChatRequestFile,
  type ChatKitMcpAppsOptions,
  type TMessageComponentMcpAppData,
} from '@xpert-ai/chatkit-types';
import type { McpAppReviveQuery } from '@xpert-ai/xpert-sdk';
import {
  AlertCircle,
  Loader2,
  Maximize2,
  Minimize2,
  PictureInPicture2,
  ShieldAlert,
} from 'lucide-react';

import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { cn } from '../../../lib/utils';
import { useStreamContext } from '../../../providers/Stream';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { IconDefinitionRenderer } from '../../ui/icon-definition';
import {
  isMcpAppRpcSuccess,
  readMcpAppDisplayMode,
  readMcpAppPendingApproval,
  triggerMcpAppDownloads,
  withMcpAppApprovalId,
  type McpAppDisplayMode,
  type McpAppJsonRpcRequest as JsonRpcRequest,
  type McpAppPendingApproval,
} from './mcp-app/host';

type JsonObject = Record<string, unknown>;

type McpJsonSchemaObject = JsonObject & {
  type: 'object';
  properties?: JsonObject;
  required?: string[];
};

type McpContentBlock = JsonObject & {
  type: string;
};

type McpCallToolResult = {
  content: McpContentBlock[];
  structuredContent?: JsonObject;
  isError?: boolean;
  _meta?: JsonObject;
};

type McpAppToolDefinition = JsonObject & {
  name: string;
  title?: TMessageComponentMcpAppData['title'];
  description?: TMessageComponentMcpAppData['description'];
  icon?: TMessageComponentMcpAppData['icon'];
  inputSchema: McpJsonSchemaObject;
};

type McpAppToolInfo = JsonObject & {
  id?: string;
  name?: string;
  originalName?: string;
  title?: TMessageComponentMcpAppData['title'];
  description?: TMessageComponentMcpAppData['description'];
  icon?: TMessageComponentMcpAppData['icon'];
  serverName?: string;
  toolCallId?: string;
  toolsetId?: string;
  tool: McpAppToolDefinition;
};

type NormalizedMcpAppResource = {
  uri?: string;
  mimeType?: string;
  html: string;
  appInstanceToken?: string;
  resourceUri?: string;
  title?: TMessageComponentMcpAppData['title'];
  description?: TMessageComponentMcpAppData['description'];
  icon?: TMessageComponentMcpAppData['icon'];
  csp?: TMessageComponentMcpAppData['csp'];
  permissions?: TMessageComponentMcpAppData['permissions'];
  domain?: string;
  prefersBorder?: boolean;
  toolInfo: McpAppToolInfo;
  toolInput: JsonObject;
  hasToolResult: boolean;
  toolResult: McpCallToolResult;
  rawToolResult: unknown;
};

type ResolvedMcpAppSandboxProxy = {
  url: string;
  origin: string;
  dedicatedOrigin: boolean;
};

const EMPTY_INPUT_SCHEMA: McpJsonSchemaObject = {
  type: 'object',
  properties: {},
};

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readRecord(value: unknown): JsonObject | undefined {
  return isRecord(value) ? value : undefined;
}

function readNonEmptyRecord(value: unknown): JsonObject | undefined {
  const record = readRecord(value);
  return record && Object.keys(record).length ? record : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readLocalizedText(
  value: unknown,
): TMessageComponentMcpAppData['title'] | undefined {
  if (typeof value === 'string') return value;
  if (isRecord(value)) return value as TMessageComponentMcpAppData['title'];
  return undefined;
}

function readIconDefinition(
  value: unknown,
): TMessageComponentMcpAppData['icon'] | undefined {
  if (!isRecord(value)) return undefined;
  return typeof value.type === 'string' && typeof value.value === 'string'
    ? (value as TMessageComponentMcpAppData['icon'])
    : undefined;
}

function readStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter(
    (item): item is string => typeof item === 'string',
  );
  return strings.length ? strings : undefined;
}

function buildMcpAppReviveQuery(
  data: TMessageComponentMcpAppData,
  options?: {
    appInstanceToken?: string;
    messageId?: string;
  },
): McpAppReviveQuery {
  return {
    toolsetId: data.toolsetId,
    serverName: data.serverName,
    toolName: data.toolName,
    toolCallId: data.toolCallId,
    resourceUri: data.resourceUri,
    title: typeof data.title === 'string' ? data.title : undefined,
    messageId: options?.messageId,
    token: options?.appInstanceToken ?? data.appInstanceToken,
  };
}

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function domains(values?: string[]) {
  return (
    values
      ?.map((value) => value.trim())
      .filter((value) => value && !/[\s;'"<>]/.test(value))
      .join(' ') ?? ''
  );
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
    `form-action ${connectDomains}`,
    `frame-src ${frameDomains}`,
    "object-src 'none'",
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

function decodeResourceHtml(resource: JsonObject) {
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

function normalizeCspMetadata(
  value: unknown,
): TMessageComponentMcpAppData['csp'] | undefined {
  const raw = readRecord(value);
  if (!raw) return undefined;

  const csp: TMessageComponentMcpAppData['csp'] = {};
  const connectDomains = readStringList(raw.connectDomains);
  const resourceDomains = readStringList(raw.resourceDomains);
  const frameDomains = readStringList(raw.frameDomains);
  const baseUriDomains = readStringList(raw.baseUriDomains);

  if (connectDomains) csp.connectDomains = connectDomains;
  if (resourceDomains) csp.resourceDomains = resourceDomains;
  if (frameDomains) csp.frameDomains = frameDomains;
  if (baseUriDomains) csp.baseUriDomains = baseUriDomains;

  return Object.keys(csp).length ? csp : undefined;
}

function normalizePermissionGrant(value: unknown) {
  return value === true || isRecord(value) ? value : undefined;
}

function normalizePermissionsMetadata(
  value: unknown,
): TMessageComponentMcpAppData['permissions'] | undefined {
  const raw = readRecord(value);
  if (!raw) return undefined;

  const permissions: TMessageComponentMcpAppData['permissions'] = {};
  const camera = normalizePermissionGrant(raw.camera);
  const microphone = normalizePermissionGrant(raw.microphone);
  const geolocation = normalizePermissionGrant(raw.geolocation);
  const clipboardWrite = normalizePermissionGrant(raw.clipboardWrite);

  if (camera !== undefined) permissions.camera = camera;
  if (microphone !== undefined) permissions.microphone = microphone;
  if (geolocation !== undefined) permissions.geolocation = geolocation;
  if (clipboardWrite !== undefined) permissions.clipboardWrite = clipboardWrite;

  return Object.keys(permissions).length ? permissions : undefined;
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

function jsonRpcError(
  id: JsonRpcRequest['id'],
  message: string,
  code = -32000,
  data?: unknown,
) {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data }),
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

function normalizeInputSchema(value: unknown): McpJsonSchemaObject {
  const raw = readRecord(value);
  if (!raw || (raw.type !== undefined && raw.type !== 'object')) {
    return EMPTY_INPUT_SCHEMA;
  }

  return {
    ...raw,
    type: 'object',
    properties: readRecord(raw.properties) ?? {},
    ...(Array.isArray(raw.required) &&
    raw.required.every((item) => typeof item === 'string')
      ? { required: raw.required }
      : {}),
  };
}

function normalizeMcpAppToolInfo(
  value: unknown,
  data: TMessageComponentMcpAppData,
  resource: Pick<
    NormalizedMcpAppResource,
    'title' | 'description' | 'icon'
  > = {},
): McpAppToolInfo {
  const raw = readRecord(value) ?? {};
  const rawTool = readRecord(raw.tool) ?? {};
  const rawName = readString(raw.name);
  const originalName =
    readString(rawTool.name) ?? readString(raw.originalName) ?? data.toolName;
  const title =
    readLocalizedText(rawTool.title) ??
    readLocalizedText(raw.title) ??
    resource.title ??
    data.title ??
    data.toolName;
  const description =
    readLocalizedText(rawTool.description) ??
    readLocalizedText(raw.description) ??
    resource.description ??
    data.description;
  const icon =
    readIconDefinition(rawTool.icon) ??
    readIconDefinition(raw.icon) ??
    resource.icon ??
    data.icon;

  return {
    ...raw,
    id: data.toolCallId,
    name: rawName ?? data.toolName,
    originalName,
    title,
    ...(description ? { description } : {}),
    ...(icon ? { icon } : {}),
    serverName: readString(raw.serverName) ?? data.serverName,
    toolCallId: readString(raw.toolCallId) ?? data.toolCallId,
    toolsetId: readString(raw.toolsetId) ?? data.toolsetId,
    tool: {
      ...rawTool,
      name: originalName,
      title: readLocalizedText(rawTool.title) ?? title,
      inputSchema: normalizeInputSchema(rawTool.inputSchema ?? raw.inputSchema),
      ...(description
        ? {
            description: readLocalizedText(rawTool.description) ?? description,
          }
        : {}),
      ...(icon ? { icon: readIconDefinition(rawTool.icon) ?? icon } : {}),
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
  return ['allow-forms', 'allow-modals', 'allow-scripts'].join(' ');
}

function isLoopbackHostname(hostname: string) {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  );
}

function normalizeRequestedDomain(value?: string) {
  const domain = value?.trim().toLowerCase().replace(/\.$/, '');
  if (!domain || /[/:?#@]/.test(domain)) return null;

  try {
    const parsed = new URL(`https://${domain}`);
    return parsed.hostname === domain && !parsed.port ? domain : null;
  } catch {
    return null;
  }
}

function domainMatchesAllowlist(domain: string, allowedDomains?: string[]) {
  return Boolean(
    allowedDomains?.some((value) => {
      const entry = value.trim().toLowerCase().replace(/\.$/, '');
      if (entry.startsWith('*.')) {
        const suffix = entry.slice(2);
        return (
          Boolean(suffix) && domain !== suffix && domain.endsWith(`.${suffix}`)
        );
      }
      return domain === entry;
    }),
  );
}

/**
 * Resolves only host-owned sandbox URLs. A server-provided `ui.domain` may
 * select an approved hostname, but is never treated as a URL by itself.
 */
export function resolveMcpAppSandboxProxy(
  options: ChatKitMcpAppsOptions | undefined,
  requestedDomain: string | undefined,
  hostLocation = window.location.href,
): ResolvedMcpAppSandboxProxy | null {
  const configuredUrl = options?.sandboxProxyUrl?.trim();
  if (!configuredUrl) return null;

  try {
    const hostOrigin = new URL(hostLocation).origin;
    const proxyUrl = new URL(configuredUrl, hostLocation);
    if (
      proxyUrl.protocol !== 'https:' &&
      !(proxyUrl.protocol === 'http:' && isLoopbackHostname(proxyUrl.hostname))
    ) {
      return null;
    }

    const domain = normalizeRequestedDomain(requestedDomain);
    const dedicatedOrigin = Boolean(
      domain &&
      (domain === proxyUrl.hostname.toLowerCase() ||
        domainMatchesAllowlist(domain, options?.allowedDomains)),
    );
    if (domain && dedicatedOrigin) {
      proxyUrl.hostname = domain;
      proxyUrl.port = '';
    }
    if (proxyUrl.origin === hostOrigin) return null;

    const fragment = new URLSearchParams(proxyUrl.hash.slice(1));
    fragment.set('parentOrigin', hostOrigin);
    proxyUrl.hash = fragment.toString();
    return {
      url: proxyUrl.toString(),
      origin: proxyUrl.origin,
      dedicatedOrigin,
    };
  } catch {
    return null;
  }
}

function buildMcpAppInnerSandbox(dedicatedOrigin: boolean) {
  return dedicatedOrigin
    ? `${buildSandboxAttribute()} allow-same-origin`
    : buildSandboxAttribute();
}

function stringifyToolResult(value: unknown) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return String(value);
  }
}

function createTextContentBlock(text: string): McpContentBlock {
  return {
    type: 'text',
    text,
  };
}

function normalizeContentBlocks(value: unknown): McpContentBlock[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is McpContentBlock =>
      isRecord(item) && typeof item.type === 'string',
  );
}

function extractLegacyArtifactMeta(value: JsonObject): JsonObject | undefined {
  const meta = readRecord(value._meta);
  if (meta) return meta;

  const entries = Object.entries(value).filter(
    ([key]) => key !== 'structuredContent' && key !== 'isError',
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function normalizeToolArtifact(value: unknown): Partial<McpCallToolResult> {
  if (isRecord(value)) {
    return {
      ...(readRecord(value.structuredContent)
        ? { structuredContent: readRecord(value.structuredContent) }
        : {}),
      ...(readBoolean(value.isError) !== undefined
        ? { isError: readBoolean(value.isError) }
        : {}),
      ...(extractLegacyArtifactMeta(value)
        ? { _meta: extractLegacyArtifactMeta(value) }
        : {}),
    };
  }

  if (!Array.isArray(value)) return {};

  return value.reduce<Partial<McpCallToolResult>>((result, item) => {
    const normalized = normalizeToolArtifact(item);
    return {
      ...result,
      ...normalized,
      _meta: result._meta ?? normalized._meta,
      structuredContent:
        result.structuredContent ?? normalized.structuredContent,
      isError: result.isError ?? normalized.isError,
    };
  }, {});
}

export function normalizeCallToolResult(value: unknown): McpCallToolResult {
  if (value === undefined) {
    return {
      content: [],
    };
  }

  if (isRecord(value)) {
    if (value.toolResult !== undefined && !Array.isArray(value.content)) {
      return normalizeCallToolResult(value.toolResult);
    }

    const content = normalizeContentBlocks(value.content);
    const result: McpCallToolResult = {
      content: content.length ? content : [],
    };
    const structuredContent = readRecord(value.structuredContent);
    const isError = readBoolean(value.isError);
    const meta = readRecord(value._meta);

    if (structuredContent) result.structuredContent = structuredContent;
    if (isError !== undefined) result.isError = isError;
    if (meta) result._meta = meta;

    return result;
  }

  if (Array.isArray(value) && value.length >= 2) {
    const [content, artifact] = value;
    const artifactFields = normalizeToolArtifact(artifact);

    return {
      content: [
        createTextContentBlock(
          typeof content === 'string' ? content : stringifyToolResult(content),
        ),
      ],
      ...artifactFields,
    };
  }

  return {
    content: [createTextContentBlock(stringifyToolResult(value))],
  };
}

export function normalizeMcpAppResourceResponse(
  value: unknown,
  data: TMessageComponentMcpAppData,
): NormalizedMcpAppResource {
  const raw = readRecord(value);
  if (!raw) {
    throw new Error('MCP App resource response must be an object');
  }

  const html = decodeResourceHtml(raw);
  if (!html) {
    throw new Error('MCP App resource did not include HTML content');
  }

  const resourceInfo = {
    title: readLocalizedText(raw.title),
    description: readLocalizedText(raw.description),
    icon: readIconDefinition(raw.icon),
  };
  const toolInput =
    readNonEmptyRecord(raw.toolInput) ??
    data.toolInput ??
    readRecord(raw.toolInput) ??
    {};
  const rawToolResult = raw.toolResult ?? data.toolResult;

  return {
    uri: readString(raw.uri),
    mimeType: readString(raw.mimeType),
    html,
    appInstanceToken: readString(raw.appInstanceToken),
    resourceUri: readString(raw.resourceUri),
    title: resourceInfo.title,
    description: resourceInfo.description,
    icon: resourceInfo.icon,
    csp: normalizeCspMetadata(raw.csp),
    permissions: normalizePermissionsMetadata(raw.permissions),
    domain: readString(raw.domain),
    prefersBorder: readBoolean(raw.prefersBorder),
    toolInfo: normalizeMcpAppToolInfo(raw.toolInfo, data, resourceInfo),
    toolInput,
    hasToolResult: rawToolResult !== undefined,
    toolResult: normalizeCallToolResult(rawToolResult),
    rawToolResult,
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

const MCP_APP_MESSAGE_MAX_BINARY_BYTES = 25 * 1024 * 1024;

type McpAppMessageInput = {
  input: string;
  files: ChatRequestFile[];
};

function normalizeMcpMimeType(value: unknown, fallback?: string) {
  const mimeType = typeof value === 'string' ? value.trim() : fallback;
  return mimeType &&
    /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i.test(mimeType)
    ? mimeType.toLowerCase()
    : null;
}

function normalizeMcpBase64(value: unknown) {
  if (typeof value !== 'string') return null;
  const data = value.replace(/\s/g, '');
  if (!data || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) {
    return null;
  }
  return data;
}

function decodedBase64Bytes(data: string) {
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return (data.length / 4) * 3 - padding;
}

function mcpMessageFile(
  data: string,
  mimeType: string,
  name: string,
): ChatRequestFile {
  return {
    name,
    originalName: name,
    mimeType,
    fileUrl: `data:${mimeType};base64,${data}`,
  };
}

function resourceLabel(resource: JsonObject) {
  const details = {
    uri: readString(resource.uri),
    mimeType: readString(resource.mimeType),
  };
  return `[Resource ${stringifyToolResult(details)}]`;
}

function resourceLinkLabel(resourceLink: JsonObject) {
  const details = {
    uri: readString(resourceLink.uri),
    name: readString(resourceLink.name),
    description: readString(resourceLink.description),
    mimeType: readString(resourceLink.mimeType),
    size: typeof resourceLink.size === 'number' ? resourceLink.size : undefined,
  };
  return `[Resource link ${stringifyToolResult(details)}]`;
}

function contentBlocksToChatInput(content: unknown): McpAppMessageInput {
  if (!Array.isArray(content)) {
    throw new Error('ui/message content must be an array');
  }

  const text: string[] = [];
  const files: ChatRequestFile[] = [];
  let binaryBytes = 0;

  content.forEach((item, index) => {
    if (!isRecord(item) || typeof item.type !== 'string') {
      throw new Error(`ui/message content block ${index + 1} is invalid`);
    }

    if (item.type === 'text') {
      if (typeof item.text !== 'string') {
        throw new Error(`ui/message text block ${index + 1} is invalid`);
      }
      if (item.text.length) text.push(item.text);
      return;
    }

    if (item.type === 'image' || item.type === 'audio') {
      const mimeType = normalizeMcpMimeType(item.mimeType);
      const data = normalizeMcpBase64(item.data);
      if (!mimeType || !data || !mimeType.startsWith(`${item.type}/`)) {
        throw new Error(
          `ui/message ${item.type} block ${index + 1} is invalid`,
        );
      }
      binaryBytes += decodedBase64Bytes(data);
      files.push(
        mcpMessageFile(data, mimeType, `mcp-app-${item.type}-${index + 1}`),
      );
      return;
    }

    if (item.type === 'resource') {
      const resource = readRecord(item.resource);
      if (!resource || typeof resource.uri !== 'string') {
        throw new Error(`ui/message resource block ${index + 1} is invalid`);
      }
      const label = resourceLabel(resource);
      if (typeof resource.text === 'string') {
        text.push(`${label}\n${resource.text}`);
        return;
      }
      const data = normalizeMcpBase64(resource.blob);
      const mimeType = normalizeMcpMimeType(
        resource.mimeType,
        'application/octet-stream',
      );
      if (!data || !mimeType) {
        throw new Error(`ui/message resource block ${index + 1} is invalid`);
      }
      binaryBytes += decodedBase64Bytes(data);
      text.push(label);
      files.push(
        mcpMessageFile(data, mimeType, `mcp-app-resource-${index + 1}`),
      );
      return;
    }

    if (item.type === 'resource_link' && typeof item.uri === 'string') {
      text.push(resourceLinkLabel(item));
      return;
    }

    throw new Error(
      `ui/message content block ${index + 1} uses an unsupported type`,
    );
  });

  if (binaryBytes > MCP_APP_MESSAGE_MAX_BINARY_BYTES) {
    throw new Error('ui/message binary content exceeds the 25 MiB limit');
  }
  if (!text.length && !files.length) {
    throw new Error('ui/message content is empty');
  }

  return {
    input: text.join('\n\n'),
    files,
  };
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
  messageId,
  className,
  mcpApps,
}: {
  data: TMessageComponentMcpAppData;
  messageId?: string;
  className?: string;
  mcpApps?: ChatKitMcpAppsOptions;
}) {
  const { i18n } = useChatkitTranslation();
  const { client, isLoading: streamIsLoading, submit } = useStreamContext();
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const appWindowRef = React.useRef<Window | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const initializedRef = React.useRef(false);
  const sentInitialResultRef = React.useRef(false);
  const modelContextRef = React.useRef<unknown>(null);
  const pendingApprovalRef = React.useRef<McpAppPendingApproval | null>(null);
  const approvalActionRef = React.useRef<'approve' | 'reject' | null>(null);
  const runtimeAppInstanceTokenRef = React.useRef<string | undefined>(
    data.appInstanceToken,
  );
  const teardownGenerationRef = React.useRef(0);
  const teardownStartedRef = React.useRef(false);
  const activeAppInstanceIdRef = React.useRef(data.appInstanceId);
  const [resource, setResource] =
    React.useState<NormalizedMcpAppResource | null>(null);
  const [runtimeAppInstanceToken, setRuntimeAppInstanceToken] = React.useState<
    string | undefined
  >(data.appInstanceToken);
  const [srcDoc, setSrcDoc] = React.useState<string | null>(null);
  const [height, setHeight] = React.useState(420);
  const [displayMode, setDisplayMode] =
    React.useState<McpAppDisplayMode>('inline');
  const [pendingApproval, setPendingApproval] =
    React.useState<McpAppPendingApproval | null>(null);
  const [approvalAction, setApprovalAction] = React.useState<
    'approve' | 'reject' | null
  >(null);
  const [approvalError, setApprovalError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isTornDown, setIsTornDown] = React.useState(false);

  const sandboxProxy = React.useMemo(
    () => resolveMcpAppSandboxProxy(mcpApps, resource?.domain ?? data.domain),
    [data.domain, mcpApps, resource?.domain],
  );

  React.useEffect(() => {
    runtimeAppInstanceTokenRef.current = runtimeAppInstanceToken;
  }, [runtimeAppInstanceToken]);

  const bindIframeRef = React.useCallback(
    (iframe: HTMLIFrameElement | null) => {
      iframeRef.current = iframe;
      if (iframe?.contentWindow) {
        appWindowRef.current = iframe.contentWindow;
      }
    },
    [],
  );

  const postToApp = React.useCallback(
    (message: unknown) => {
      iframeRef.current?.contentWindow?.postMessage(
        message,
        sandboxProxy?.origin ?? '*',
      );
    },
    [sandboxProxy?.origin],
  );

  const callHostRpc = React.useCallback(
    async (request: JsonRpcRequest) => {
      return client.mcp.apps.rpc(
        data.appInstanceId,
        {
          jsonrpc: '2.0',
          id: request.id ?? null,
          method: request.method,
          params: request.params,
        },
        buildMcpAppReviveQuery(data, {
          appInstanceToken: runtimeAppInstanceToken,
          messageId,
        }),
      );
    },
    [client, data, messageId, runtimeAppInstanceToken],
  );

  const clearPendingApproval = React.useCallback(() => {
    pendingApprovalRef.current = null;
    approvalActionRef.current = null;
    setPendingApproval(null);
    setApprovalAction(null);
    setApprovalError(null);
  }, []);

  const isSupersededStrictModeTeardown = React.useCallback(
    (generation: number, appInstanceId: string) =>
      teardownGenerationRef.current !== generation &&
      activeAppInstanceIdRef.current === appInstanceId,
    [],
  );

  const processHostRpcResponse = React.useCallback(
    (request: JsonRpcRequest, response: unknown) => {
      const nextApproval = readMcpAppPendingApproval(response, request);
      if (nextApproval) {
        if (pendingApprovalRef.current) {
          postToApp(
            jsonRpcError(
              request.id,
              'Another MCP App approval request is already pending',
              -32004,
            ),
          );
          return;
        }
        pendingApprovalRef.current = nextApproval;
        setPendingApproval(nextApproval);
        setApprovalError(null);
        return;
      }

      const nextDisplayMode = readMcpAppDisplayMode(response);
      if (request.method === 'ui/request-display-mode' && nextDisplayMode) {
        setDisplayMode(nextDisplayMode);
      }

      if (
        request.method === 'ui/download-file' &&
        isMcpAppRpcSuccess(response)
      ) {
        try {
          triggerMcpAppDownloads(request.params);
        } catch (downloadError) {
          postToApp(
            jsonRpcError(request.id, getErrorMessage(downloadError), -32005),
          );
          return;
        }
      }

      postToApp(response);
    },
    [postToApp],
  );

  const dispatchHostRpc = React.useCallback(
    async (request: JsonRpcRequest) => {
      try {
        processHostRpcResponse(request, await callHostRpc(request));
      } catch (rpcError) {
        postToApp(jsonRpcError(request.id, getErrorMessage(rpcError)));
      }
    },
    [callHostRpc, postToApp, processHostRpcResponse],
  );

  const resolvePendingApproval = React.useCallback(
    async (action: 'approve' | 'reject') => {
      const approval = pendingApprovalRef.current;
      if (!approval || approvalActionRef.current) return;
      if (approval.expiresAt <= Date.now()) {
        clearPendingApproval();
        postToApp(
          jsonRpcError(
            approval.request.id,
            'The MCP App approval request expired',
            -32003,
          ),
        );
        return;
      }

      approvalActionRef.current = action;
      setApprovalAction(action);
      setApprovalError(null);
      const query = buildMcpAppReviveQuery(data, {
        appInstanceToken: runtimeAppInstanceToken,
        messageId,
      });
      try {
        if (action === 'reject') {
          await client.mcp.apps.reject(
            data.appInstanceId,
            approval.approvalId,
            query,
          );
          clearPendingApproval();
          postToApp(
            jsonRpcError(
              approval.request.id,
              'The user rejected the MCP App action',
              -32002,
              { approvalId: approval.approvalId, rejected: true },
            ),
          );
          return;
        }

        await client.mcp.apps.approve(
          data.appInstanceId,
          approval.approvalId,
          query,
        );
        const retryRequest = withMcpAppApprovalId(
          approval.request,
          approval.approvalId,
        );
        const response = await callHostRpc(retryRequest);
        clearPendingApproval();
        processHostRpcResponse(retryRequest, response);
      } catch (approvalRequestError) {
        approvalActionRef.current = null;
        setApprovalAction(null);
        setApprovalError(getErrorMessage(approvalRequestError));
      }
    },
    [
      callHostRpc,
      clearPendingApproval,
      client,
      data,
      messageId,
      postToApp,
      processHostRpcResponse,
      runtimeAppInstanceToken,
    ],
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
        arguments: resource.toolInput,
      },
    });
    if (!resource.hasToolResult) {
      return;
    }
    postToApp({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: {
        ...resource.toolResult,
        toolCallId: data.toolCallId,
        toolName: data.toolName,
        // Legacy compatibility for apps written before the 2026-01-26 notification shape.
        result: resource.rawToolResult,
      },
    });
  }, [data.toolCallId, data.toolName, postToApp, resource]);

  React.useEffect(() => {
    const controller = new AbortController();
    initializedRef.current = false;
    sentInitialResultRef.current = false;
    pendingApprovalRef.current = null;
    approvalActionRef.current = null;
    setRuntimeAppInstanceToken(data.appInstanceToken);
    runtimeAppInstanceTokenRef.current = data.appInstanceToken;
    teardownStartedRef.current = false;
    setIsTornDown(false);
    setDisplayMode('inline');
    setPendingApproval(null);
    setApprovalAction(null);
    setApprovalError(null);
    setIsLoading(true);
    setError(null);
    setResource(null);
    setSrcDoc(null);

    void (async () => {
      try {
        const payload = await client.mcp.apps.getResource(
          data.appInstanceId,
          buildMcpAppReviveQuery(data, { messageId }),
          { signal: controller.signal },
        );
        const normalizedResource = normalizeMcpAppResourceResponse(
          payload,
          data,
        );

        setResource(normalizedResource);
        const nextAppInstanceToken =
          normalizedResource.appInstanceToken ?? data.appInstanceToken;
        runtimeAppInstanceTokenRef.current = nextAppInstanceToken;
        setRuntimeAppInstanceToken(nextAppInstanceToken);
        const hostLocale = normalizeHostLocale(i18n.language);
        setSrcDoc(
          injectMcpAppTheme(
            injectCsp(
              injectMcpAppLocale(normalizedResource.html, hostLocale),
              normalizedResource.csp ?? data.csp,
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
    client,
    data,
    data.appInstanceId,
    data.appInstanceToken,
    data.csp,
    i18n.language,
    messageId,
  ]);

  React.useEffect(() => {
    const generation = ++teardownGenerationRef.current;
    activeAppInstanceIdRef.current = data.appInstanceId;
    return () => {
      const appWindow = appWindowRef.current;
      const appOrigin = sandboxProxy?.origin ?? '*';
      const query = buildMcpAppReviveQuery(data, {
        appInstanceToken: runtimeAppInstanceTokenRef.current,
        messageId,
      });
      const approval = pendingApprovalRef.current;
      queueMicrotask(() => {
        if (isSupersededStrictModeTeardown(generation, data.appInstanceId)) {
          return;
        }
        if (teardownStartedRef.current) {
          return;
        }
        teardownStartedRef.current = true;
        try {
          appWindow?.postMessage(
            {
              jsonrpc: '2.0',
              id: `xpert-teardown-${data.appInstanceId}`,
              method: 'ui/resource-teardown',
              params: { reason: 'host-unmount' },
            },
            appOrigin,
          );
        } catch {
          // Detached iframe windows can disappear before React effect cleanup.
        }
        void (async () => {
          if (approval) {
            await client.mcp.apps
              .reject(data.appInstanceId, approval.approvalId, query)
              .catch(() => undefined);
          }
          await client.mcp.apps
            .teardown(data.appInstanceId, query)
            .catch(() => undefined);
        })();
      });
    };
  }, [
    client,
    data,
    data.appInstanceId,
    isSupersededStrictModeTeardown,
    messageId,
    sandboxProxy?.origin,
  ]);

  React.useEffect(() => {
    if (!pendingApproval) return;
    const remaining = pendingApproval.expiresAt - Date.now();
    if (remaining <= 0) {
      clearPendingApproval();
      postToApp(
        jsonRpcError(
          pendingApproval.request.id,
          'The MCP App approval request expired',
          -32003,
        ),
      );
      return;
    }
    const timeout = window.setTimeout(() => {
      if (
        pendingApprovalRef.current?.approvalId !== pendingApproval.approvalId
      ) {
        return;
      }
      clearPendingApproval();
      postToApp(
        jsonRpcError(
          pendingApproval.request.id,
          'The MCP App approval request expired',
          -32003,
        ),
      );
    }, remaining);
    return () => window.clearTimeout(timeout);
  }, [clearPendingApproval, pendingApproval, postToApp]);

  React.useEffect(() => {
    sendInitialToolNotifications();
  }, [sendInitialToolNotifications]);

  React.useEffect(() => {
    if (!initializedRef.current) return;
    postToApp({
      jsonrpc: '2.0',
      method: 'ui/notifications/host-context-changed',
      params: {
        displayMode,
        containerDimensions: getContainerDimensions(containerRef.current),
      },
    });
  }, [displayMode, height, postToApp]);

  React.useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (sandboxProxy && event.origin !== sandboxProxy.origin) {
        return;
      }

      const request = normalizeJsonRpcMessage(event.data);
      if (!request?.method) {
        return;
      }

      if (
        request.method === 'ui/notifications/sandbox-proxy-ready' &&
        sandboxProxy &&
        srcDoc
      ) {
        const permissions = resource?.permissions ?? data.permissions;
        const csp = resource?.csp ?? data.csp;
        postToApp({
          jsonrpc: '2.0',
          method: 'ui/notifications/sandbox-resource-ready',
          params: {
            html: srcDoc,
            sandbox: buildMcpAppInnerSandbox(sandboxProxy.dedicatedOrigin),
            ...(csp ? { csp } : {}),
            ...(permissions ? { permissions } : {}),
          },
        });
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

      if (request.method === 'ui/notifications/request-teardown') {
        if (teardownStartedRef.current) {
          return;
        }
        teardownStartedRef.current = true;
        postToApp({
          jsonrpc: '2.0',
          id: `xpert-teardown-${data.appInstanceId}`,
          method: 'ui/resource-teardown',
          params: { reason: 'app-requested' },
        });
        const query = buildMcpAppReviveQuery(data, {
          appInstanceToken: runtimeAppInstanceTokenRef.current,
          messageId,
        });
        const approval = pendingApprovalRef.current;
        try {
          if (approval) {
            await client.mcp.apps.reject(
              data.appInstanceId,
              approval.approvalId,
              query,
            );
          }
          await client.mcp.apps.teardown(data.appInstanceId, query);
          clearPendingApproval();
          setIsTornDown(true);
        } catch (teardownError) {
          teardownStartedRef.current = false;
          setError(getErrorMessage(teardownError));
        }
        return;
      }

      if (request.method === 'ui/initialize') {
        initializedRef.current = true;
        const permissions = resource?.permissions ?? data.permissions;
        const csp = resource?.csp ?? data.csp;
        const toolInfo =
          resource?.toolInfo ?? normalizeMcpAppToolInfo(undefined, data);
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
                image: {},
                audio: {},
                resource: {},
                resourceLink: {},
              },
              updateModelContext: {
                text: {},
                structuredContent: {},
              },
              sandbox: {
                ...(permissions ? { permissions } : {}),
                ...(csp ? { csp } : {}),
              },
              downloadFile: {},
            },
            hostContext: {
              toolInfo,
              theme: theme.mode,
              styles: {
                variables: theme.cssVariables,
              },
              themeCssVariables: theme.cssVariables,
              locale: hostLocale,
              language: hostLanguage,
              direction: hostDirection,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              displayMode,
              availableDisplayModes: ['inline', 'fullscreen', 'pip'],
              containerDimensions: getContainerDimensions(containerRef.current),
              userAgent: 'xpert-chatkit',
              platform: 'web',
              deviceCapabilities: {
                touch: navigator.maxTouchPoints > 0,
                hover:
                  typeof window.matchMedia === 'function'
                    ? window.matchMedia('(hover: hover)').matches
                    : false,
              },
            },
            // Legacy compatibility for apps written before the 2026-01-26 result shape.
            capabilities: {
              displayModes: ['inline', 'fullscreen', 'pip'],
              serverTools: true,
              serverResources: true,
              openLinks: true,
            },
            context: {
              toolInfo,
              theme: theme.mode,
              themeCssVariables: theme.cssVariables,
              locale: hostLocale,
              language: hostLanguage,
              direction: hostDirection,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              displayMode,
              availableDisplayModes: ['inline', 'fullscreen', 'pip'],
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
            : isRecord(request.params) &&
                typeof request.params.href === 'string'
              ? request.params.href
              : null;
        if (!href || !isHttpUrl(href)) {
          if (request.id !== undefined) {
            postToApp(jsonRpcError(request.id, 'Invalid URL'));
          }
          return;
        }
        try {
          const response = await callHostRpc({
            ...request,
            params: { url: href },
          });
          if (isMcpAppRpcSuccess(response)) {
            window.open(href, '_blank', 'noopener,noreferrer');
          }
          postToApp(response);
        } catch (linkError) {
          postToApp(jsonRpcError(request.id, getErrorMessage(linkError)));
        }
        return;
      }

      if (request.method === 'ui/update-model-context') {
        try {
          const response = await callHostRpc(request);
          if (isMcpAppRpcSuccess(response)) {
            modelContextRef.current = request.params;
          }
          postToApp(response);
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

          const messageInput = contentBlocksToChatInput(request.params.content);

          await submit(
            {
              input: {
                input: messageInput.input,
                ...(messageInput.files.length
                  ? { files: messageInput.files }
                  : {}),
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

      await dispatchHostRpc(request);
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [
    callHostRpc,
    clearPendingApproval,
    client,
    data,
    dispatchHostRpc,
    displayMode,
    i18n.language,
    messageId,
    postToApp,
    resource?.csp,
    resource?.permissions,
    resource?.toolInfo,
    sandboxProxy,
    sendInitialToolNotifications,
    srcDoc,
    streamIsLoading,
    submit,
  ]);

  const iframePermissions = resource?.permissions ?? data.permissions;
  const iframeAllow = React.useMemo(
    () => buildIframeAllow(iframePermissions),
    [iframePermissions],
  );
  const sandbox = sandboxProxy
    ? 'allow-scripts allow-same-origin'
    : buildSandboxAttribute();
  const prefersBorder = resource?.prefersBorder ?? data.prefersBorder ?? true;
  const displayTitle =
    resolveLocalizedText(resource?.title ?? data.title, i18n.language) ??
    data.toolName;
  const displayDescription = resolveLocalizedText(
    resource?.description ?? data.description,
    i18n.language,
  );
  const displayIcon = resource?.icon ?? data.icon;
  const elevatedDisplayMode = displayMode !== 'inline';

  if (isTornDown) {
    return null;
  }

  return (
    <>
      {displayMode === 'fullscreen' ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[79] bg-background/80 backdrop-blur-sm"
        />
      ) : null}
      <div
        ref={containerRef}
        data-display-mode={displayMode}
        className={cn(
          'relative flex flex-col overflow-hidden rounded-lg border bg-background shadow-sm',
          displayMode === 'fullscreen' && 'fixed inset-4 z-[80] shadow-2xl',
          displayMode === 'pip' &&
            'fixed right-4 bottom-4 z-[80] h-[min(640px,calc(100vh-2rem))] w-[min(480px,calc(100vw-2rem))] shadow-2xl',
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
          <div className="flex shrink-0 items-center gap-1">
            {displayMode !== 'fullscreen' ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                title={i18n.t('message.mcpApp.fullscreen')}
                aria-label={i18n.t('message.mcpApp.fullscreen')}
                onClick={() => setDisplayMode('fullscreen')}
              >
                <Maximize2 />
              </Button>
            ) : null}
            {displayMode !== 'pip' ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                title={i18n.t('message.mcpApp.pictureInPicture')}
                aria-label={i18n.t('message.mcpApp.pictureInPicture')}
                onClick={() => setDisplayMode('pip')}
              >
                <PictureInPicture2 />
              </Button>
            ) : null}
            {elevatedDisplayMode ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                title={i18n.t('message.mcpApp.returnInline')}
                aria-label={i18n.t('message.mcpApp.returnInline')}
                onClick={() => setDisplayMode('inline')}
              >
                <Minimize2 />
              </Button>
            ) : null}
            <Badge variant="secondary" className="ml-1 rounded-md">
              MCP App
            </Badge>
          </div>
        </div>

        {pendingApproval ? (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`mcp-app-approval-${pendingApproval.approvalId}`}
            className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm"
          >
            <div className="flex max-h-full w-full max-w-lg flex-col gap-4 overflow-hidden rounded-lg border bg-background p-4 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-destructive/10 p-2 text-destructive">
                  <ShieldAlert className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      id={`mcp-app-approval-${pendingApproval.approvalId}`}
                      className="text-sm font-semibold"
                    >
                      {i18n.t('message.mcpApp.approvalTitle')}
                    </h3>
                    <Badge
                      variant="outline"
                      className="border-destructive/40 text-destructive"
                    >
                      {pendingApproval.risk}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {i18n.t(
                      pendingApproval.kind === 'download'
                        ? 'message.mcpApp.downloadApprovalDescription'
                        : 'message.mcpApp.toolApprovalDescription',
                      { tool: pendingApproval.toolName },
                    )}
                  </p>
                </div>
              </div>

              <div className="min-h-0">
                <div className="mb-1 text-xs font-medium">
                  {i18n.t('message.mcpApp.requestDetails')}
                </div>
                <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 text-[11px] leading-5 whitespace-pre-wrap break-all">
                  {pendingApproval.details}
                </pre>
              </div>

              {approvalError ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 text-xs text-destructive"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{approvalError}</span>
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={approvalAction !== null}
                  onClick={() => void resolvePendingApproval('reject')}
                >
                  {approvalAction === 'reject' ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  {i18n.t('message.mcpApp.reject')}
                </Button>
                <Button
                  type="button"
                  variant={
                    pendingApproval.risk === 'destructive'
                      ? 'destructive'
                      : 'default'
                  }
                  disabled={approvalAction !== null}
                  onClick={() => void resolvePendingApproval('approve')}
                >
                  {approvalAction === 'approve' ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  {i18n.t('message.mcpApp.approve')}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div
            className={cn(
              'flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground',
              elevatedDisplayMode && 'min-h-0 flex-1',
            )}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{i18n.t('message.mcpApp.loading')}</span>
          </div>
        ) : error ? (
          <div
            className={cn(
              'flex h-40 items-center justify-center gap-2 px-4 text-sm text-destructive',
              elevatedDisplayMode && 'min-h-0 flex-1',
            )}
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words">{error}</span>
          </div>
        ) : srcDoc ? (
          <iframe
            ref={bindIframeRef}
            title={displayTitle}
            {...(sandboxProxy ? { src: sandboxProxy.url } : { srcDoc })}
            className={cn(
              'block w-full bg-background',
              elevatedDisplayMode && 'min-h-0 flex-1',
            )}
            style={elevatedDisplayMode ? undefined : { height }}
            sandbox={sandbox}
            allow={iframeAllow}
            referrerPolicy="no-referrer"
          />
        ) : null}
      </div>
    </>
  );
}
