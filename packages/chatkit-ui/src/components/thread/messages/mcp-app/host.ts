export type McpAppJsonRpcRequest = {
  jsonrpc?: '2.0';
  id?: string | number | null;
  method?: string;
  params?: unknown;
};

export type McpAppDisplayMode = 'inline' | 'fullscreen' | 'pip';

export type McpAppPendingApproval = {
  approvalId: string;
  risk: 'write' | 'destructive';
  expiresAt: number;
  toolName: string;
  kind: 'tool' | 'download';
  request: McpAppJsonRpcRequest;
  details: string;
};

function isObject(value: unknown): value is object {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function property(value: object, key: string): unknown {
  return Reflect.get(value, key);
}

function stringProperty(value: object, key: string): string | undefined {
  const field = property(value, key);
  return typeof field === 'string' && field.trim() ? field.trim() : undefined;
}

export function getMcpAppRpcErrorCode(value: unknown): number | undefined {
  if (!isObject(value)) return undefined;
  const error = property(value, 'error');
  if (!isObject(error)) return undefined;
  const code = property(error, 'code');
  return typeof code === 'number' ? code : undefined;
}

export function isMcpAppRpcSuccess(value: unknown) {
  return (
    isObject(value) &&
    Reflect.has(value, 'result') &&
    !Reflect.has(value, 'error')
  );
}

export function readMcpAppDisplayMode(
  value: unknown,
): McpAppDisplayMode | undefined {
  if (!isObject(value)) return undefined;
  const result = property(value, 'result');
  if (!isObject(result)) return undefined;
  const mode = property(result, 'mode');
  if (mode === 'picture-in-picture') return 'pip';
  return mode === 'inline' || mode === 'fullscreen' || mode === 'pip'
    ? mode
    : undefined;
}

export function readMcpAppPendingApproval(
  response: unknown,
  request: McpAppJsonRpcRequest,
): McpAppPendingApproval | null {
  if (!isObject(response)) return null;
  const error = property(response, 'error');
  if (!isObject(error) || property(error, 'code') !== -32001) return null;
  const data = property(error, 'data');
  if (!isObject(data)) return null;

  const approvalId = stringProperty(data, 'approvalId');
  const risk = property(data, 'risk');
  const expiresAt = property(data, 'expiresAt');
  if (
    !approvalId ||
    (risk !== 'write' && risk !== 'destructive') ||
    typeof expiresAt !== 'number' ||
    !Number.isFinite(expiresAt)
  ) {
    return null;
  }

  const params = isObject(request.params) ? request.params : undefined;
  const requestedTool = params ? stringProperty(params, 'name') : undefined;
  const kind = request.method === 'ui/download-file' ? 'download' : 'tool';

  return {
    approvalId,
    risk,
    expiresAt,
    toolName:
      kind === 'download'
        ? 'ui/download-file'
        : (requestedTool ?? request.method ?? 'tools/call'),
    kind,
    request,
    details:
      kind === 'download'
        ? formatDownloadApprovalDetails(request.params)
        : formatApprovalDetails(request.params),
  };
}

export function withMcpAppApprovalId(
  request: McpAppJsonRpcRequest,
  approvalId: string,
): McpAppJsonRpcRequest {
  return {
    ...request,
    params: {
      ...(isObject(request.params) ? request.params : {}),
      approvalId,
    },
  };
}

function formatApprovalDetails(value: unknown) {
  try {
    const text = JSON.stringify(redactSensitiveValue(value, 0), null, 2);
    if (!text) return '{}';
    return text.length > 4_000 ? `${text.slice(0, 4_000)}\n…` : text;
  } catch {
    return '[Request details unavailable]';
  }
}

function redactSensitiveValue(value: unknown, depth: number): unknown {
  if (depth >= 6) return '[Nested value omitted]';
  if (typeof value === 'string' && value.length > 1_000) {
    return `${value.slice(0, 1_000)}… [${value.length} characters]`;
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map((item) => redactSensitiveValue(item, depth + 1));
  }
  if (!isObject(value)) return value;

  const output: { [key: string]: unknown } = {};
  for (const [key, field] of Object.entries(value).slice(0, 50)) {
    output[key] = /password|secret|token|authorization|api[-_]?key/i.test(key)
      ? '[Redacted]'
      : redactSensitiveValue(field, depth + 1);
  }
  return output;
}

function formatDownloadApprovalDetails(value: unknown) {
  if (!isObject(value)) return '{}';
  const contents = property(value, 'contents');
  if (!Array.isArray(contents)) return '{}';
  const summary = contents.slice(0, 20).map((item) => {
    if (!isObject(item)) return { type: 'invalid' };
    if (property(item, 'type') === 'resource_link') {
      return {
        type: 'resource_link',
        name: stringProperty(item, 'name'),
        uri: stringProperty(item, 'uri'),
        mimeType: stringProperty(item, 'mimeType'),
      };
    }
    const resource = property(item, 'resource');
    if (!isObject(resource)) return { type: property(item, 'type') };
    const text = property(resource, 'text');
    const blob = property(resource, 'blob');
    return {
      type: 'resource',
      name: stringProperty(resource, 'name'),
      uri: stringProperty(resource, 'uri'),
      mimeType: stringProperty(resource, 'mimeType'),
      size:
        typeof text === 'string'
          ? `${new TextEncoder().encode(text).byteLength} bytes`
          : typeof blob === 'string'
            ? `approximately ${Math.floor((blob.length * 3) / 4)} bytes`
            : undefined,
    };
  });
  return JSON.stringify({ files: summary }, null, 2);
}

type DownloadItem =
  | {
      kind: 'embedded';
      filename: string;
      mimeType: string;
      text?: string;
      blob?: string;
    }
  | {
      kind: 'link';
      filename: string;
      uri: string;
    };

export function triggerMcpAppDownloads(value: unknown) {
  const downloads = parseDownloadItems(value);
  for (const download of downloads) {
    if (download.kind === 'link') {
      clickDownload(download.uri, download.filename);
      continue;
    }

    const blob = new Blob(
      [
        download.text !== undefined
          ? download.text
          : decodeBase64(download.blob ?? ''),
      ],
      { type: download.mimeType },
    );
    const url = URL.createObjectURL(blob);
    clickDownload(url, download.filename);
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function parseDownloadItems(value: unknown): DownloadItem[] {
  if (!isObject(value)) throw new Error('Download params must be an object');
  if (property(value, 'isError') === true) {
    throw new Error('The MCP App reported that the download failed');
  }
  const contents = property(value, 'contents');
  if (!Array.isArray(contents) || contents.length === 0) {
    throw new Error('Download contents must be a non-empty array');
  }

  return contents.map((item, index) => {
    if (!isObject(item)) throw new Error('Download content is invalid');
    const type = property(item, 'type');
    if (type === 'resource_link') {
      const uri = stringProperty(item, 'uri');
      const name = stringProperty(item, 'name');
      if (!uri || !name || !isHttpUrl(uri)) {
        throw new Error(
          'Download link must use HTTP or HTTPS and include a name',
        );
      }
      return {
        kind: 'link' as const,
        filename: sanitizeFilename(name, index),
        uri,
      };
    }

    if (type !== 'resource') {
      throw new Error('Download content type is unsupported');
    }
    const resource = property(item, 'resource');
    if (!isObject(resource)) throw new Error('Embedded download is invalid');
    const uri = stringProperty(resource, 'uri');
    if (!uri) throw new Error('Embedded download URI is required');
    const text = property(resource, 'text');
    const blob = property(resource, 'blob');
    if (typeof text !== 'string' && typeof blob !== 'string') {
      throw new Error('Embedded download must include text or base64 data');
    }
    const common = {
      kind: 'embedded' as const,
      filename: sanitizeFilename(
        stringProperty(resource, 'name') ?? filenameFromUri(uri),
        index,
      ),
      mimeType:
        stringProperty(resource, 'mimeType') ?? 'application/octet-stream',
    };
    return typeof text === 'string'
      ? { ...common, text }
      : { ...common, blob: blob as string };
  });
}

function decodeBase64(value: string) {
  const decoded = window.atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function filenameFromUri(uri: string) {
  try {
    const pathname = new URL(uri).pathname;
    const segment = pathname.split('/').filter(Boolean).at(-1);
    return segment ? decodeURIComponent(segment) : 'download';
  } catch {
    return uri.split('/').filter(Boolean).at(-1) ?? 'download';
  }
}

function sanitizeFilename(value: string, index: number) {
  const sanitized = Array.from(value, (character) =>
    character.charCodeAt(0) <= 31 || /[\\/:*?"<>|]/.test(character)
      ? '_'
      : character,
  )
    .join('')
    .trim()
    .slice(0, 255);
  return sanitized || `download-${index + 1}`;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function clickDownload(uri: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = uri;
  anchor.download = filename;
  anchor.rel = 'noopener noreferrer';
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
