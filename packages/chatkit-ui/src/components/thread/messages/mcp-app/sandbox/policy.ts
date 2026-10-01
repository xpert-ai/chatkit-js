import type {
  ChatKitMcpAppsOptions,
  TMessageComponentMcpAppData,
} from '@xpert-ai/chatkit-types';
import { isRecord } from '../resource/values';
import type { ResolvedMcpAppSandboxProxy } from '../types';

export function domains(values?: string[]) {
  return (
    values
      ?.map((value) => value.trim())
      .filter((value) => value && !/[\s;'"<>]/.test(value))
      .join(' ') ?? ''
  );
}

export function buildCsp(csp?: TMessageComponentMcpAppData['csp']) {
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

export function hasPermissionGrant(value: unknown) {
  return value === true || isRecord(value);
}

export function buildIframeAllow(
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

export function buildSandboxAttribute() {
  return ['allow-forms', 'allow-modals', 'allow-scripts'].join(' ');
}

export function isLoopbackHostname(hostname: string) {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  );
}

export function normalizeRequestedDomain(value?: string) {
  const domain = value?.trim().toLowerCase().replace(/\.$/, '');
  if (!domain || /[/:?#@]/.test(domain)) return null;

  try {
    const parsed = new URL(`https://${domain}`);
    return parsed.hostname === domain && !parsed.port ? domain : null;
  } catch {
    return null;
  }
}

export function domainMatchesAllowlist(
  domain: string,
  allowedDomains?: string[],
) {
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

export function buildMcpAppInnerSandbox(dedicatedOrigin: boolean) {
  return dedicatedOrigin
    ? `${buildSandboxAttribute()} allow-same-origin`
    : buildSandboxAttribute();
}
