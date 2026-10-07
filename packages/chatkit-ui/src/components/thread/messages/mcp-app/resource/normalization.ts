import type { TMessageComponentMcpAppData } from '@xpert-ai/chatkit-types';
import type { McpAppReviveQuery } from '@xpert-ai/xpert-sdk';
import type {
  JsonObject,
  McpAppToolInfo,
  McpJsonSchemaObject,
  NormalizedMcpAppResource,
} from '../types';
import { normalizeCallToolResult } from './tool-result';
import {
  isRecord,
  readBoolean,
  readIconDefinition,
  readLocalizedText,
  readNonEmptyRecord,
  readRecord,
  readString,
  readStringList,
} from './values';

export const EMPTY_INPUT_SCHEMA: McpJsonSchemaObject = {
  type: 'object',
  properties: {},
};

export function buildMcpAppReviveQuery(
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

export function decodeResourceHtml(resource: JsonObject) {
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

export function normalizeCspMetadata(
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

export function normalizePermissionGrant(value: unknown) {
  return value === true || isRecord(value) ? value : undefined;
}

export function normalizePermissionsMetadata(
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

export function normalizeInputSchema(value: unknown): McpJsonSchemaObject {
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

export function normalizeMcpAppToolInfo(
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
    refresh: readRefresh(raw.refresh),
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

function readRefresh(value: unknown): NormalizedMcpAppResource['refresh'] {
  const raw = readRecord(value);
  const toolName = raw && readString(raw.toolName);
  if (!raw || !toolName) return undefined;
  if (raw.arguments !== undefined && !isRecord(raw.arguments)) return undefined;
  return { toolName, arguments: readRecord(raw.arguments) };
}
