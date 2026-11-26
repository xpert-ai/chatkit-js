import { z } from 'zod';
import type { Thread } from '@xpert-ai/xpert-sdk';
import type { SideChatSession } from './types';

const metadata = z.object({
  purpose: z.enum(['side-chat', 'message-edit']).optional(),
  parent_thread_id: z.string().optional(),
  title: z.string().optional(),
});
const layout = z.object({
  opened: z.array(z.string()).max(100),
  active: z.string().nullable(),
  selected: z.record(z.string(), z.string()).default({}),
});
export function readSideChatLayout(scope: string) {
  try {
    return layout.parse(
      JSON.parse(
        localStorage.getItem(`chatkit:side-chats:v1:${scope}`) || 'null',
      ),
    );
  } catch {
    return { opened: [], active: null, selected: {} };
  }
}
export function writeSideChatLayout(
  scope: string,
  opened: string[],
  active: string | null,
  selected: { [id: string]: string } = {},
) {
  try {
    localStorage.setItem(
      `chatkit:side-chats:v1:${scope}`,
      JSON.stringify({ opened, active, selected }),
    );
  } catch {
    /* Storage can be unavailable in embedded hosts. */
  }
}

/** Only explicit side-chat records become tabs. Message edits stay within their lineage. */
export function sideChatRecords(
  threads: Thread[],
  fallbackTitle: string,
  pendingTitles?: ReadonlyMap<string, string>,
): SideChatSession[] {
  return threads.flatMap((thread) => {
    const parsed = metadata.safeParse(thread.metadata);
    if (!parsed.success || parsed.data.purpose !== 'side-chat') return [];
    return [
      {
        threadId: thread.thread_id,
        sourceThreadId: parsed.data.parent_thread_id ?? '',
        title:
          parsed.data.title?.trim() ||
          pendingTitles?.get(thread.thread_id) ||
          fallbackTitle,
        status: thread.status,
        updatedAt: thread.updated_at,
      },
    ];
  });
}

/** Local selection is only restored after proving membership in the authorized lineage. */
export function sideChatSelection(
  threads: Thread[],
  root: string,
  selected?: string,
): string {
  const byId = new Map(threads.map((thread) => [thread.thread_id, thread]));
  const seen = new Set<string>();
  let id = selected;
  while (id && !seen.has(id)) {
    if (id === root) return selected ?? root;
    seen.add(id);
    const thread = byId.get(id);
    const parsed = metadata.safeParse(thread?.metadata);
    if (!parsed.success || parsed.data.purpose !== 'message-edit') break;
    id = parsed.data.parent_thread_id;
  }
  return root;
}
