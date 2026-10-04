import type { ChatKitQuoteReference } from '@xpert-ai/chatkit-types';
import { previewRuntimeScript } from './runtime';
import type { WorkbenchPreview } from '../client-command-payload';

/** Read the saved version through the SDK; never request privileged host commands. */
export function createHtmlArtifactPreview(
  resource: { artifactId: string; artifactVersionId: string },
  title: string,
  request: (signal: AbortSignal) => Promise<Blob>,
  unavailableMessage: string,
  onAnnotate?: (reference: ChatKitQuoteReference) => Promise<void>,
): WorkbenchPreview {
  return {
    key: `chatkit.preview.html:${resource.artifactId}:${resource.artifactVersionId}`,
    kind: 'html',
    title,
    url: '',
    html: {
      identity: resource,
      onAnnotate,
      load: async (signal) => {
        const blob = await request(signal);
        if (
          blob.type.split(';')[0].trim().toLowerCase() !== 'text/html' ||
          blob.size < 1 ||
          blob.size > 64 * 1024 * 1024
        )
          throw new Error(unavailableMessage);
        return { blob, name: title };
      },
    },
  };
}

/** Run self-contained HTML in an opaque-origin frame, without platform/network access. */
export function prepareHtmlPreview(source: string, session?: string) {
  const document = new DOMParser().parseFromString(source, 'text/html');
  document
    .querySelectorAll('base, meta[http-equiv="refresh" i]')
    .forEach((node) => node.remove());
  const policy = document.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content =
    "default-src 'none'; script-src 'unsafe-inline' data: blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  document.head.prepend(policy);
  if (session) {
    const script = document.createElement('script');
    script.textContent = previewRuntimeScript(session);
    policy.after(script);
  }
  const external = (value: string) =>
    value.trim() && !/^(?:data:|blob:|#)/i.test(value.trim());
  const hasExternalResources =
    Array.from(
      document.querySelectorAll(
        'script[src], img[src], link[rel="stylesheet"], source[src], video[src], audio[src], [poster], [srcset]',
      ),
    ).some((node) =>
      ['src', 'href', 'poster', 'srcset'].some((attribute) =>
        external(node.getAttribute(attribute) ?? ''),
      ),
    ) ||
    Array.from(
      source.matchAll(/url\(\s*['"]?([^)'"\s]+)|@import\s+['"]([^'"]+)/gi),
    ).some((match) => external(match[1] ?? match[2] ?? ''));
  return {
    srcDoc: `<!doctype html>\n${document.documentElement.outerHTML}`,
    hasExternalResources,
  };
}
