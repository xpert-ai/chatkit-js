import type { ChatRequestFile } from '@xpert-ai/chatkit-types';
import { stringifyToolResult } from '../resource/tool-result';
import { isRecord, readRecord, readString } from '../resource/values';
import type { JsonObject, McpAppMessageInput } from '../types';

export const MCP_APP_MESSAGE_MAX_BINARY_BYTES = 25 * 1024 * 1024;

export function normalizeMcpMimeType(value: unknown, fallback?: string) {
  const mimeType = typeof value === 'string' ? value.trim() : fallback;
  return mimeType &&
    /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i.test(mimeType)
    ? mimeType.toLowerCase()
    : null;
}

export function normalizeMcpBase64(value: unknown) {
  if (typeof value !== 'string') return null;
  const data = value.replace(/\s/g, '');
  if (!data || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) {
    return null;
  }
  return data;
}

export function decodedBase64Bytes(data: string) {
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return (data.length / 4) * 3 - padding;
}

export function mcpMessageFile(
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

export function resourceLabel(resource: JsonObject) {
  const details = {
    uri: readString(resource.uri),
    mimeType: readString(resource.mimeType),
  };
  return `[Resource ${stringifyToolResult(details)}]`;
}

export function resourceLinkLabel(resourceLink: JsonObject) {
  const details = {
    uri: readString(resourceLink.uri),
    name: readString(resourceLink.name),
    description: readString(resourceLink.description),
    mimeType: readString(resourceLink.mimeType),
    size: typeof resourceLink.size === 'number' ? resourceLink.size : undefined,
  };
  return `[Resource link ${stringifyToolResult(details)}]`;
}

export function contentBlocksToChatInput(content: unknown): McpAppMessageInput {
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
