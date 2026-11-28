import { z } from 'zod';
import type { Thread } from '@xpert-ai/xpert-sdk';
import type { SideChatSession } from './types';

const metadata = z.object({
  purpose: z.enum(['side-chat', 'message-edit']).optional(),
  parent_thread_id: z.string().optional(),
  forked_from_message_id: z.string().optional(),
  title: z.string().optional(),
  titleSource: z.string().optional(),
  archived: z.boolean().optional(),
});
const layout = z.object({
  opened: z.array(z.string()).max(100),
  active: z.string().nullable(),
  selected: z.record(z.string(), z.string()).default({}),
  titles: z.record(z.string(), z.string()).default({}),
  sequences: z.record(z.string(), z.number().int().positive()).default({}),
});
export function readSideChatLayout(scope: string) {
  try {
    return layout.parse(
      JSON.parse(
        localStorage.getItem(`chatkit:side-chats:v1:${scope}`) || 'null',
      ),
    );
  } catch {
    return {
      opened: [],
      active: null,
      selected: {},
      titles: {},
      sequences: {},
    };
  }
}
export function writeSideChatLayout(
  scope: string,
  opened: string[],
  active: string | null,
  selected: { [id: string]: string } = {},
  titles: { [id: string]: string } = {},
  sequences: { [id: string]: number } = {},
) {
  try {
    localStorage.setItem(
      `chatkit:side-chats:v1:${scope}`,
      JSON.stringify({ opened, active, selected, titles, sequences }),
    );
  } catch {
    /* Storage can be unavailable in embedded hosts. */
  }
}

/** Only explicit side-chat records become tabs. Message edits stay within their lineage. */
export function sideChatRecords(
  threads: Thread[],
  fallbackTitle: string | ((sequence: number) => string),
  pendingTitles?: ReadonlyMap<string, string>,
  knownSequences?: ReadonlyMap<string, number>,
): SideChatSession[] {
  const records = threads.flatMap((thread) => {
    const parsed = metadata.safeParse(thread.metadata);
    if (!parsed.success || parsed.data.purpose !== 'side-chat') return [];
    return [{ thread, metadata: parsed.data }];
  });
  // API lists may be ordered by last activity; tab order and edits must not renumber defaults.
  const sequence = new Map(knownSequences);
  let nextSequence = Math.max(0, ...sequence.values());
  [...records]
    .sort(
      (a, b) =>
        (a.thread.created_at ?? '').localeCompare(b.thread.created_at ?? '') ||
        a.thread.thread_id.localeCompare(b.thread.thread_id),
    )
    .forEach(({ thread }) => {
      if (!sequence.has(thread.thread_id))
        sequence.set(thread.thread_id, ++nextSequence);
    });
  return records.map(({ thread, metadata }) => {
    const defaultTitle =
      typeof fallbackTitle === 'function'
        ? fallbackTitle(sequence.get(thread.thread_id)!)
        : fallbackTitle;
    return {
      threadId: thread.thread_id,
      sequence: sequence.get(thread.thread_id),
      archived: metadata.archived === true,
      sourceThreadId: metadata.parent_thread_id ?? '',
      inheritedMessagesEndId: metadata.forked_from_message_id,
      title:
        metadata.titleSource === 'default'
          ? defaultTitle
          : metadata.title?.trim() ||
            pendingTitles?.get(thread.thread_id) ||
            defaultTitle,
      status: thread.status,
      updatedAt: thread.updated_at,
    };
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
