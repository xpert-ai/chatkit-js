export type MissingApiConfigurationKind =
  | 'apiUrl'
  | 'clientSecret'
  | 'apiUrlAndClientSecret';

function hasConfiguredValue(value?: string | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function getMissingApiConfigurationKind({
  apiUrl,
  clientSecret,
}: {
  apiUrl?: string | null;
  clientSecret?: string | null;
}): MissingApiConfigurationKind | null {
  const hasApiUrl = hasConfiguredValue(apiUrl);
  const hasClientSecret = hasConfiguredValue(clientSecret);

  if (hasApiUrl && hasClientSecret) {
    return null;
  }

  if (!hasApiUrl && !hasClientSecret) {
    return 'apiUrlAndClientSecret';
  }

  return hasApiUrl ? 'clientSecret' : 'apiUrl';
}

export function createMissingApiConfigurationError({
  apiUrl,
  clientSecret,
}: {
  apiUrl?: string | null;
  clientSecret?: string | null;
}): Error | null {
  const missingKind = getMissingApiConfigurationKind({ apiUrl, clientSecret });
  if (!missingKind) {
    return null;
  }

  switch (missingKind) {
    case 'apiUrl':
      return new Error('Missing ChatKit API URL');
    case 'clientSecret':
      return new Error('Missing ChatKit client secret');
    case 'apiUrlAndClientSecret':
      return new Error('Missing ChatKit API URL and client secret');
    default:
      return new Error('Missing ChatKit configuration');
  }
}
