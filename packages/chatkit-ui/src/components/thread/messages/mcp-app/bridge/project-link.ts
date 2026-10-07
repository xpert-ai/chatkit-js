import { z } from 'zod';
const projectId = z.string().uuid();
/** Host-owned link scheme, converted to authorized Workbench navigation, never window.open. */
export function parseMcpAppProjectLink(
  href: string,
): { projectId: string; viewKey: string } | null {
  try {
    const url = new URL(href);
    if (
      url.protocol !== 'xpert:' ||
      url.hostname !== 'project' ||
      url.username ||
      url.password ||
      url.port ||
      url.hash
    )
      return null;
    const id = projectId.safeParse(decodeURIComponent(url.pathname.slice(1)));
    const viewKey = url.searchParams.get('viewKey');
    if (!id.success || !viewKey || !/^[\w.-]+__[\w.-]+$/.test(viewKey))
      return null;
    if (url.searchParams.size !== 1) return null;
    return { projectId: id.data, viewKey };
  } catch {
    return null;
  }
}
