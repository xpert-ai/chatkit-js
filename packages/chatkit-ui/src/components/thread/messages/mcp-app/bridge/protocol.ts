import type { McpAppJsonRpcRequest as JsonRpcRequest } from '../host';
import { isRecord } from '../resource/values';

export function normalizeJsonRpcMessage(value: unknown): JsonRpcRequest | null {
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

export function jsonRpcResult(id: JsonRpcRequest['id'], result: unknown) {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    result,
  };
}

export function jsonRpcError(
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

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
