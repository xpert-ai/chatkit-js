import type {
  ChatKitClientSecretObject,
} from '@xpert-ai/chatkit-types';

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
