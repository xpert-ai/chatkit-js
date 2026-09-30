import type { ChatKitClientSecretObject } from '@xpert-ai/chatkit-types';

export type ResolvedClientSecret = ChatKitClientSecretObject;

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeSecret(value: unknown): string {
  const secret = normalizeOptionalString(value);
  if (!secret) {
    throw new Error('[chatkit-ui] Parent returned an invalid client secret.');
  }
  return secret;
}

export function normalizeClientSecretResult(
  result: unknown,
  fallbackOrganizationId?: string | null,
): ResolvedClientSecret {
  if (typeof result === 'string') {
    const secret = normalizeSecret(result);
    const organizationId = normalizeOptionalString(fallbackOrganizationId);

    return organizationId ? { secret, organizationId } : { secret };
  }

  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const secret = normalizeSecret(
      (result as Partial<ChatKitClientSecretObject>).secret,
    );
    const organizationId = normalizeOptionalString(
      (result as Partial<ChatKitClientSecretObject>).organizationId,
    );
    const xpertId = normalizeOptionalString(
      (result as Partial<ChatKitClientSecretObject>).xpertId,
    );
    const assistantId = normalizeOptionalString(
      (result as Partial<ChatKitClientSecretObject>).assistantId,
    );

    return {
      secret,
      ...(organizationId ? { organizationId } : {}),
      ...(xpertId ? { xpertId } : {}),
      ...(assistantId ? { assistantId } : {}),
    };
  }

  throw new Error('[chatkit-ui] Parent returned an invalid client secret.');
}

export function withClientSecretHeaders(
  headers: HeadersInit | undefined,
  clientSecret: ResolvedClientSecret,
): Headers {
  const nextHeaders = new Headers(headers);
  if (clientSecret.secret) {
    nextHeaders.set('Authorization', `Bearer ${clientSecret.secret}`);
    nextHeaders.set('x-api-key', clientSecret.secret);
  } else {
    nextHeaders.delete('Authorization');
    nextHeaders.delete('x-api-key');
  }

  if (clientSecret.organizationId) {
    nextHeaders.set('organization-id', clientSecret.organizationId);
  } else {
    nextHeaders.delete('organization-id');
  }

  return nextHeaders;
}

/** Socket transports also use this hook; authentication must precede fetch. */
export function createSdkRequestHook(
  getClientSecret: () => ResolvedClientSecret,
  getLastEventId: () => string | null | undefined = () => undefined,
) {
  return (url: URL, init: RequestInit): RequestInit => {
    const headers = withClientSecretHeaders(init.headers, getClientSecret());
    const lastEventId = getLastEventId();
    if (lastEventId && url.pathname.endsWith('/runs/stream')) {
      headers.set('Last-Event-ID', lastEventId);
    }
    return { ...init, headers };
  };
}
