import type { Client, ConversationSidebarQuery } from '@xpert-ai/xpert-sdk';

/** Older hosts can still browse ordinary history; authorization errors never fall back. */
export async function fetchSidebarHistory(
  client: Client,
  query: ConversationSidebarQuery,
  signal: AbortSignal,
) {
  if (typeof client.conversations.listSidebar === 'function') {
    try {
      return {
        ...(await client.conversations.listSidebar(query, { signal })),
        sidebarSupported: true,
      };
    } catch (error) {
      if (
        signal.aborted ||
        query.archived ||
        !(error instanceof Error) ||
        !('status' in error) ||
        (error.status !== 404 && error.status !== 405 && error.status !== 501)
      )
        throw error;
    }
  } else if (query.archived) {
    throw new Error('Archived history is unavailable');
  }
  const result = await client.conversations.search(
    {
      where: {
        xpertId: query.assistantId,
        ...(query.projectId === undefined
          ? {}
          : { projectId: query.projectId }),
      },
      search: query.search,
      limit: query.limit,
      offset: query.offset,
      order: { updatedAt: 'DESC', id: 'DESC' },
    },
    { signal },
  );
  return { ...result, sidebarSupported: false };
}
