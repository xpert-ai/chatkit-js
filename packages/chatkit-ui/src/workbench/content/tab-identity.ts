import { z } from 'zod';
import type { XpertViewQuery } from '@xpert-ai/xpert-sdk';

const prefix = 'chatkit.content:';
const identity = z.tuple([z.string().min(1), z.string().uuid()]);

/** A tab is an editor + stable resource, while all backend calls still use the manifest key.
 * Only resolved catalog content opts in; legacy singleton views keep their existing lifetime. */
export function contentTabKey(viewKey: string, query: XpertViewQuery): string {
  const contentId = z.string().uuid().safeParse(query.parameters?.contentId);
  return contentId.success
    ? prefix + JSON.stringify([contentViewKey(viewKey), contentId.data])
    : viewKey;
}

export function contentViewKey(tabKey: string): string {
  if (!tabKey.startsWith(prefix)) return tabKey;
  try {
    const parsed = identity.safeParse(JSON.parse(tabKey.slice(prefix.length)));
    return parsed.success ? parsed.data[0] : tabKey;
  } catch {
    return tabKey;
  }
}
