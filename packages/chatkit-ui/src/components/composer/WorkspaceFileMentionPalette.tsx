import * as React from 'react';
import { FileText, Loader2 } from 'lucide-react';
import type { Client, XpertWorkspaceFile } from '@xpert-ai/xpert-sdk';

import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { cn } from '../../lib/utils';

export type WorkspaceFileMentionPaletteHandle = {
  moveActive: (direction: -1 | 1) => void;
  selectActive: () => boolean;
};

export type WorkspaceFileMentionPaletteProps = {
  client: Client | null;
  assistantId: string | null;
  projectId: string | null;
  query: string;
  selectedFilePaths: ReadonlySet<string>;
  onSelect: (file: XpertWorkspaceFile) => void;
  className?: string;
};

const WORKSPACE_FILE_LIST_DEPTH = 12;

export function getWorkspaceFilePath(file: XpertWorkspaceFile): string {
  return file.fullPath?.trim() || file.filePath.trim();
}

function flattenWorkspaceFiles(
  files: XpertWorkspaceFile[],
): XpertWorkspaceFile[] {
  return files.flatMap((file) => {
    const children = Array.isArray(file.children) ? file.children : [];
    const isDirectory = file.fileType === 'directory' || file.hasChildren;
    return [...(isDirectory ? [] : [file]), ...flattenWorkspaceFiles(children)];
  });
}

export const WorkspaceFileMentionPalette = React.forwardRef<
  WorkspaceFileMentionPaletteHandle,
  WorkspaceFileMentionPaletteProps
>(function WorkspaceFileMentionPalette(
  {
    client,
    assistantId,
    projectId,
    query,
    selectedFilePaths,
    onSelect,
    className,
  },
  ref,
) {
  const { t } = useChatkitTranslation();
  const [files, setFiles] = React.useState<XpertWorkspaceFile[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const activeIndexRef = React.useRef(0);
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const loadErrorMessage = t('composer.fileMentions.loadError');

  React.useEffect(() => {
    if (!client || (!projectId && !assistantId)) {
      setFiles([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const request = projectId
      ? client.projects.listFiles(projectId, {
          depth: WORKSPACE_FILE_LIST_DEPTH,
          signal: controller.signal,
        })
      : client.xperts.listWorkspaceFiles(assistantId as string, {
          depth: WORKSPACE_FILE_LIST_DEPTH,
          signal: controller.signal,
        });
    request
      .then((nextFiles) => {
        if (!controller.signal.aborted) {
          setFiles(flattenWorkspaceFiles(nextFiles));
        }
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        console.warn('[Chat] Failed to load workspace files:', loadError);
        setFiles([]);
        setError(loadErrorMessage);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [assistantId, client, loadErrorMessage, projectId]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleFiles = React.useMemo(
    () =>
      files.filter((file) => {
        const filePath = getWorkspaceFilePath(file);
        if (selectedFilePaths.has(filePath)) return false;
        if (!normalizedQuery) return true;
        return `${file.filePath} ${filePath}`
          .toLocaleLowerCase()
          .includes(normalizedQuery);
      }),
    [files, normalizedQuery, selectedFilePaths],
  );

  React.useLayoutEffect(() => {
    setActiveIndex((current) => {
      const nextIndex =
        visibleFiles.length === 0
          ? 0
          : Math.min(current, visibleFiles.length - 1);
      activeIndexRef.current = nextIndex;
      return nextIndex;
    });
  }, [visibleFiles.length]);

  React.useEffect(() => {
    optionRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex]);

  React.useImperativeHandle(
    ref,
    () => ({
      moveActive: (direction) => {
        if (!visibleFiles.length) return;
        const nextIndex =
          (activeIndexRef.current + direction + visibleFiles.length) %
          visibleFiles.length;
        activeIndexRef.current = nextIndex;
        setActiveIndex(nextIndex);
      },
      selectActive: () => {
        const file = visibleFiles[activeIndexRef.current];
        if (!file) return false;
        onSelect(file);
        return true;
      },
    }),
    [onSelect, visibleFiles],
  );

  const unavailable = !client || (!projectId && !assistantId);

  return (
    <div
      data-slot="workspace-file-mention-palette"
      className={cn(
        'mb-2 overflow-hidden rounded-lg border border-border bg-popover shadow-md',
        className,
      )}
    >
      <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
        {t('composer.fileMentions.title')}
        {query ? <span className="ml-1 text-foreground">@{query}</span> : null}
      </div>
      <div className="max-h-56 overflow-y-auto p-1">
        {unavailable ? (
          <PaletteMessage>
            {t('composer.fileMentions.unavailable')}
          </PaletteMessage>
        ) : loading ? (
          <PaletteMessage>
            <Loader2 className="size-4 animate-spin" />
            {t('composer.fileMentions.loading')}
          </PaletteMessage>
        ) : error ? (
          <PaletteMessage role="alert">{error}</PaletteMessage>
        ) : visibleFiles.length === 0 ? (
          <PaletteMessage>{t('composer.fileMentions.empty')}</PaletteMessage>
        ) : (
          visibleFiles.map((file, index) => {
            const filePath = getWorkspaceFilePath(file);
            const label = file.filePath || filePath;
            return (
              <button
                key={filePath}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                type="button"
                aria-label={label}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(file);
                }}
                onMouseEnter={() => {
                  activeIndexRef.current = index;
                  setActiveIndex(index);
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted',
                  index === activeIndex && 'bg-muted',
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
                  <FileText className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{label}</span>
                  {filePath || file.mimeType ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {filePath || file.mimeType}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
});

function PaletteMessage({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: React.AriaRole;
}) {
  return (
    <div
      role={role}
      className="flex min-h-20 items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground"
    >
      {children}
    </div>
  );
}
