import type { ContentClient, ContentScope } from '@xpert-ai/xpert-sdk';
import type { NavigationPayload } from '../client-command-payload';

/** Public catalog links contain a stable ID, not a provider's private selection ID.
 * Resolve on every entry, after authentication and Project selection. Never trust a stale view key.
 * This is shared Workbench routing; business editors do not need to understand catalog IDs. */
export async function resolveContentEntry(
  navigation: NavigationPayload,
  api: ContentClient,
  scope: ContentScope,
): Promise<NavigationPayload> {
  if (navigation.query.parameters?.contentProvider !== 'platform.content.catalog' || !navigation.query.selectionId)
    return navigation;
  const editorKey = navigation.query.parameters?.contentEditor;
  const resolved = await api.resolve(scope, {
    providerKey: 'platform.content.catalog',
    resourceId: navigation.query.selectionId,
    ...(typeof editorKey === 'string' ? { editorKey } : {}),
  });
  return { ...navigation, viewKey: resolved.viewKey, query: {
    selectionId: resolved.selectionId ?? navigation.query.selectionId,
    parameters: { ...resolved.parameters,
      ...(navigation.query.parameters?.blockId ? { blockId: navigation.query.parameters.blockId } : {}),
    },
  } };
}
