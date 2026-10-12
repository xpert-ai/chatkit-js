import { isMcpAppSessionError } from '@xpert-ai/xpert-sdk';

export type McpAppResourceFailure = 'expired' | 'unavailable' | 'forbidden';

export function isMcpAppAccessDenied(error: unknown): boolean {
  // The SDK's HTTPError carries the HTTP status separately from its message.
  return error instanceof Error && 'status' in error && error.status === 403;
}

export function getMcpAppResourceFailure(
  error: unknown,
): McpAppResourceFailure {
  // Localized error text and generic transport failures cannot establish expiry.
  // Only the SDK's recognized session code permits the expired presentation.
  if (isMcpAppAccessDenied(error)) return 'forbidden';
  if (isMcpAppSessionError(error) && error.code === 'MCP_APP_SESSION_EXPIRED') {
    return 'expired';
  }
  return 'unavailable';
}
