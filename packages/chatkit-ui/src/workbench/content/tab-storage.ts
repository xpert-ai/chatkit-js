import { z } from 'zod';
import type { XpertViewQuery } from '@xpert-ai/xpert-sdk';
import { contentViewKey } from './tab-identity';

const references = z.array(z.object({
  contentId: z.string().uuid(),
  editorKey: z.string().optional(),
})).max(24);
export type StoredContentTab = z.infer<typeof references>[number];
const storageKey = (scope: string) => `chatkit.content-tabs.v1:${scope}`;

/** Persist references only. Titles, source IDs, permissions and tokens are never a cache authority. */
export function readContentTabs(scope: string): StoredContentTab[] {
  try {
    const result = references.safeParse(JSON.parse(sessionStorage.getItem(storageKey(scope)) ?? '[]'));
    return result.success ? result.data : [];
  } catch { return []; }
}

export function writeContentTabs(scope: string, keys: string[], queries: Record<string, XpertViewQuery>) {
  const tabs = keys.flatMap((key) => {
    if (contentViewKey(key) === key) return [];
    const parsed = references.element.safeParse({ contentId: queries[key]?.parameters?.contentId,
      editorKey: queries[key]?.parameters?.contentEditor });
    return parsed.success ? [parsed.data] : [];
  }).slice(-24);
  try { sessionStorage.setItem(storageKey(scope), JSON.stringify(tabs)); } catch { /* Storage may be unavailable in embedded browsers. */ }
}
