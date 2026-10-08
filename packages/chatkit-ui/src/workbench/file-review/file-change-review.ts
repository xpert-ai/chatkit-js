import type { Client } from '@xpert-ai/xpert-sdk';
import {
  fileChangeRangeKey,
  normalizeFileChanges,
  parseFileChangeReport,
  type FileChangeResource,
  type FileChangeSetResource,
} from '@xpert-ai/chatkit-types';
import type {
  WorkbenchPreview,
  ReviewWorkbenchPreview,
} from '../preview/types';

import type { FileReviewEntry } from './types';
/** Review endpoints stay pinned to the original first/last reports, including after refresh. */
export function createFileChangeReview(
  client: Client,
  conversationId: string,
  selected: FileChangeResource | FileChangeSetResource,
  title: string,
  openPreview?: (preview: WorkbenchPreview) => void,
): ReviewWorkbenchPreview {
  return {
    key: `chatkit.preview.review:${conversationId}`,
    kind: 'review',
    title,
    review: {
      selected,
      openFile: openPreview
        ? (entry) => {
            const snapshot = entry.report?.after ?? entry.report?.before;
            if (snapshot?.text === undefined) return;
            openPreview({
              key: `chatkit.preview.review-file:${conversationId}:${entry.key}:${snapshot.sha256}`,
              kind: 'snapshot',
              title: entry.path.split('/').pop() || title,
              snapshot: { path: entry.path, text: snapshot.text },
            });
          }
        : undefined,
      load: async (scope, signal) => {
        const targets: {
          workspacePath: string;
          resource?: FileChangeResource;
        }[] = [];
        if (scope === 'conversation') {
          for (let offset = 0; ; ) {
            const page = await client.conversations.listTaskSummaryItems(
              conversationId,
              'fileChanges',
              { offset, limit: 50, signal },
            );
            signal.throwIfAborted();
            targets.push(...normalizeFileChanges(page.items));
            offset += page.items.length;
            if (offset >= page.total) break;
            if (!page.items.length)
              throw new Error('Incomplete file change history');
          }
        } else if (selected.type === 'file_change_set')
          targets.push(...selected.changes);
        else targets.push({ workspacePath: '', resource: selected });
        const entries: FileReviewEntry[] = [];
        for (let offset = 0; offset < targets.length; offset += 4) {
          signal.throwIfAborted();
          entries.push(
            ...(await Promise.all(
              targets
                .slice(offset, offset + 4)
                .map(async ({ workspacePath, resource }) => {
                  const key = resource
                    ? fileChangeRangeKey(resource)
                    : workspacePath;
                  if (!resource) return { key, path: workspacePath };
                  try {
                    const read = async (ref: FileChangeResource['first']) => {
                      const blob = await client.workbench.downloadArtifact(
                        conversationId,
                        ref,
                        { signal },
                      );
                      if (blob.size > 300_000)
                        throw new Error(
                          'File change report exceeds the preview limit',
                        );
                      return parseFileChangeReport(
                        JSON.parse(await blob.text()),
                      );
                    };
                    const firstRequest = read(resource.first);
                    const same =
                      resource.first.artifactId === resource.last.artifactId &&
                      resource.first.artifactVersionId ===
                        resource.last.artifactVersionId;
                    const [first, last] = await Promise.all([
                      firstRequest,
                      same ? firstRequest : read(resource.last),
                    ]);
                    if (
                      !first ||
                      !last ||
                      first.workspacePath !== last.workspacePath ||
                      (workspacePath && last.workspacePath !== workspacePath)
                    )
                      throw new Error('Invalid file change report');
                    return {
                      key,
                      path: last.workspacePath,
                      report: { ...last, before: first.before },
                    };
                  } catch {
                    signal.throwIfAborted();
                    return { key, path: workspacePath };
                  }
                }),
            )),
          );
        }
        signal.throwIfAborted();
        return entries;
      },
    },
  };
}
