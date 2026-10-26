import { z } from 'zod';
import type {
  ContentClient,
  ContentScope,
  ContentReviewState,
  ContentResource,
} from '@xpert-ai/xpert-sdk';
import type { EditorLifecycle } from '../editors/editor-lifecycle';

const resourceSchema = z.object({
  resourceId: z.string().uuid(),
  providerKey: z.string().min(1).optional(),
  editorKey: z.string().min(1).max(200).optional(),
  blockId: z.string().max(160).optional(),
});
export type ReviewSession = {
  resourceId: string;
  blockId: string | null;
  viewKey: string;
  state: ContentReviewState;
};
export type ContentCommandHost = {
  api: ContentClient;
  scope: ContentScope;
  viewKey: string;
  editors: EditorLifecycle;
  isCurrent: () => boolean;
  close: (viewKey: string) => void;
  review: (session: ReviewSession) => void;
  linkBaseUrl?: string;
  copy: (text: string) => Promise<boolean>;
};
export const isContentCommand = (key: string) =>
  key.startsWith('workbench.content.') || key === 'assistant.content.review';

/** Content commands are owned here and never fall through to an embedder's command handler. */
export async function executeContentCommand(
  command: string,
  payload: unknown,
  host: ContentCommandHost,
): Promise<unknown> {
  const stale = () => ({ success: false, code: 'stale_context' });
  if (!host.isCurrent()) return stale();
  if (!host.scope.projectId)
    return { success: false, code: 'project_required' };
  if (command === 'workbench.content.close') {
    if (!(await host.editors.prepare(host.viewKey)))
      return { success: false, code: 'unsaved_changes' };
    if (!host.isCurrent()) return stale();
    // Give the invoking frame its reply before disposing the tab.
    setTimeout(() => {
      if (host.isCurrent()) host.close(host.viewKey);
    }, 0);
    return { success: true };
  }
  if (
    ![
      'workbench.content.resolve',
      'workbench.content.link',
      'workbench.content.copyLink',
      'assistant.content.review',
    ].includes(command)
  )
    return { success: false, code: 'unsupported' };
  const parsed = resourceSchema.safeParse(payload);
  if (!parsed.success) return { success: false, code: 'invalid_payload' };
  const resource = parsed.data;
  if (command === 'assistant.content.review') {
    if (!(await host.editors.prepare(host.viewKey)))
      return { success: false, code: 'unsaved_changes' };
    if (!host.isCurrent()) return stale();
    const state = await host.api.review(host.scope, resource.resourceId);
    if (!host.isCurrent()) return stale();
    host.review({
      resourceId: resource.resourceId,
      blockId: resource.blockId ?? null,
      viewKey: host.viewKey,
      state,
    });
    return { success: true };
  }
  const resolved = await host.api.resolve(host.scope, resource);
  if (!host.isCurrent()) return stale();
  const navigation = {
    target: 'workbench.view',
    viewKey: resolved.viewKey,
    selectionId: resolved.selectionId ?? resource.resourceId,
    ...(resolved.parameters ? { parameters: resolved.parameters } : {}),
  };
  if (command === 'workbench.content.resolve')
    return { success: true, navigation };
  if (!host.linkBaseUrl) return { success: false, code: 'link_unavailable' };
  const url = resourceLink(
    host.linkBaseUrl,
    host.scope,
    {
      ...resource,
      // Keep a catalog reference stable even when its active implementation changes.
      providerKey: resource.providerKey ?? resolved.parameters?.contentProvider,
    },
    resolved.viewKey,
  );
  if (command === 'workbench.content.copyLink')
    return { success: await host.copy(url), url };
  return { success: true, url };
}

/** The embedding application supplies only its public entry URL, never document navigation callbacks. */
export function resourceLink(
  base: string,
  scope: ContentScope,
  resource: ContentResource & { blockId?: string },
  viewKey: string,
) {
  const url = new URL(
    base.replace('{projectId}', encodeURIComponent(scope.projectId)),
  );
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('Invalid Workbench link URL.');
  url.hash = '';
  url.search = '';
  url.searchParams.set('view', viewKey);
  url.searchParams.set('viewSelection', resource.resourceId);
  url.searchParams.set('contentResource', resource.resourceId);
  url.searchParams.set(
    'viewParameters',
    JSON.stringify({
      ...(resource.providerKey
        ? { contentProvider: resource.providerKey }
        : {}),
      ...(resource.blockId ? { blockId: resource.blockId } : {}),
      ...(resource.editorKey ? { contentEditor: resource.editorKey } : {}),
    }),
  );
  return url.href;
}
