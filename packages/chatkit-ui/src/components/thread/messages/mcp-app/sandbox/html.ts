import type { TMessageComponentMcpAppData } from '@xpert-ai/chatkit-types';
import { buildCsp } from './policy';

export function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function injectHeadContent(html: string, content: string) {
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${content}`);
  }

  return `<!doctype html><html><head>${content}</head><body>${html}</body></html>`;
}

export function injectCsp(
  html: string,
  csp?: TMessageComponentMcpAppData['csp'],
) {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttribute(
    buildCsp(csp),
  )}">`;

  return injectHeadContent(html, meta);
}
