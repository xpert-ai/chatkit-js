import type {
  ConnectorRuntimeOption,
  ConnectorScope,
  ConnectorStrategyDefinition,
} from '@xpert-ai/xpert-sdk';

type DirectOAuthMethod = {
  authMethodId?: string;
};

export function resolveConnectorManagementUrl(
  apiUrl: string | undefined,
  scope: ConnectorScope,
): string {
  const base = apiUrl?.trim() || window.location.href;
  const path =
    scope.type === 'project'
      ? `/project/${encodeURIComponent(scope.projectId)}/config`
      : `/xpert/w/${encodeURIComponent(scope.workspaceId)}/connectors`;
  return new URL(path, base).toString();
}

export function resolveDirectOAuthMethod(
  definition:
    | ConnectorStrategyDefinition
    | Pick<ConnectorRuntimeOption, 'authMethods'>,
): DirectOAuthMethod | null {
  if ('authMethods' in definition && definition.authMethods?.length) {
    if (definition.authMethods.length !== 1) return null;
    const method = definition.authMethods[0];
    if (method.type !== 'oauth2' || method.appCredentials?.fields?.length) {
      return null;
    }
    return { authMethodId: method.id };
  }

  if (!('auth' in definition) || definition.auth?.type !== 'oauth2') {
    return null;
  }
  if (definition.appCredentials?.fields?.length) return null;
  return { authMethodId: definition.legacyAuthMethodId };
}

export function connectionErrorKey(error: unknown) {
  if (error instanceof Error && 'status' in error) {
    if (error.status === 401) return 'composer.connections.signInRequired';
    if (error.status === 403) return 'composer.connections.contextDenied';
    if (error.status === 404) return 'composer.connections.unavailable';
  }
  return 'composer.connections.failed';
}
