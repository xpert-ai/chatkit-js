import { parsePreview, type WorkbenchPreview } from './client-command-payload';

export type WorkbenchAddress =
  | { kind: 'url'; preview: WorkbenchPreview }
  | { kind: 'search' | 'invalid' };

/** Address-bar input never resolves a search term relative to the API URL. */
export function resolveWorkbenchAddress(
  value: string,
  apiUrl: string,
): WorkbenchAddress {
  const input = value.trim();
  if (!input) return { kind: 'search' };
  let url = input;
  const host =
    /^(localhost|(?:[\p{L}\p{N}-]+\.)+[\p{L}\p{N}-]+|\[[\da-f:]+\])(?::\d+)?(?:[/?#]|$)/iu.exec(
      input,
    );
  if (host) {
    const local = /^(localhost|127(?:\.\d+){3}|\[::1\])$/i.test(host[1]);
    url = `${local ? 'http' : 'https'}://${input}`;
  } else if (!/^https?:\/\//i.test(input)) {
    return { kind: /^[a-z][a-z\d+.-]*:/i.test(input) ? 'invalid' : 'search' };
  }
  const preview = parsePreview('browser', { url }, apiUrl);
  return preview ? { kind: 'url', preview } : { kind: 'invalid' };
}
