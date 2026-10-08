import type {
  NativeTool,
  RecentWorkspaceFile,
} from '../native/useNativeWorkbench';
import type { XpertWorkspaceFile } from '@xpert-ai/xpert-sdk';
import * as React from 'react';
import type { XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
import {
  File,
  Globe,
  Layers,
  Loader2,
  Folder,
  Terminal,
  MessageSquarePlus,
  Grid2X2,
  ChevronDown,
} from 'lucide-react';
import { IconDefinitionRenderer } from '../../components/ui/icon-definition';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { useTheme } from '../../providers/Theme';
import { getSurfaceThemeStyle } from '../../lib/theme-surfaces';
import type { WorkbenchPreview } from '../preview/types';
import {
  WorkbenchAddressBar,
  type BrowserNavigation,
  type AddressSuggestion,
} from '../browser-preview/WorkbenchAddressBar';
import { resolveWorkbenchAddress } from '../browser-preview/workbench-address';
import { resolveManifestText } from '../manifest-text';
import type { RecentWorkbenchPreview } from '../useWorkbenchPages';

export function WorkbenchStartPage({
  navigation,
  views,
  openedViewKeys = [],
  recentFiles = [],
  onOpenTool,
  onOpenFile,
  conversationReady = false,
  sideChatEnabled = true,
  recent,
  locale,
  apiUrl,
  loading,
  error,
  onReload,
  onSelectView,
  onOpenPreview,
}: {
  navigation?: BrowserNavigation;
  views: XpertExtensionViewManifest[];
  openedViewKeys?: string[];
  recentFiles?: RecentWorkspaceFile[];
  onOpenTool?: (tool: NativeTool) => void;
  onOpenFile?: (file: XpertWorkspaceFile) => void;
  conversationReady?: boolean;
  sideChatEnabled?: boolean;
  recent: RecentWorkbenchPreview[];
  locale: string;
  apiUrl: string;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onSelectView: (key: string) => void;
  onOpenPreview: (preview: WorkbenchPreview) => void;
}) {
  const { t } = useChatkitTranslation();
  const { theme } = useTheme();
  const [query, setQuery] = React.useState('');
  const search = query.trim().toLocaleLowerCase(locale);
  const label = (view: XpertExtensionViewManifest) =>
    resolveManifestText(
      view.workbench?.menu?.label ?? view.title,
      view.key,
      locale,
    );
  const description = (view: XpertExtensionViewManifest) =>
    resolveManifestText(view.description, '', locale);
  const filtered = views.filter((view) =>
    `${label(view)} ${description(view)}`
      .toLocaleLowerCase(locale)
      .includes(search),
  );
  const tools = [
    { key: 'files' as const, icon: Folder, disabled: false },
    { key: 'terminal' as const, icon: Terminal, disabled: !conversationReady },
    {
      key: 'side-chat' as const,
      icon: MessageSquarePlus,
      disabled: !conversationReady || !sideChatEnabled,
    },
  ].filter((tool) =>
    t(`workbench.start.${tool.key === 'side-chat' ? 'sideChat' : tool.key}`)
      .toLocaleLowerCase(locale)
      .includes(search),
  );
  const dynamic = filtered.filter(
    (view) =>
      view.workbench?.openMode === 'on-demand' ||
      !openedViewKeys.includes(view.key),
  );
  const [moreTools, setMoreTools] = React.useState(false);
  const recentWorkspaceFiles = recentFiles.filter((item) =>
    item.file.filePath.toLocaleLowerCase(locale).includes(search),
  );
  const recentItems = recent.filter((item) =>
    `${item.preview.title} ${'url' in item.preview ? item.preview.url : ''}`
      .toLocaleLowerCase(locale)
      .includes(search),
  );
  const matches =
    tools.length +
    dynamic.length +
    recentItems.length +
    recentWorkspaceFiles.length;
  const date = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const sectionId = React.useId();
  const icon = (view: XpertExtensionViewManifest, size: number) => (
    <IconDefinitionRenderer
      icon={view.workbench?.menu?.icon ?? view.icon}
      size={size}
      fallback={<Layers size={size} className="text-muted-foreground" />}
    />
  );
  const urlQuery = resolveWorkbenchAddress(query, apiUrl).kind !== 'search';
  const suggestions: AddressSuggestion[] = [
    ...recent.map(({ preview }) => ({
      key: preview.key,
      title: preview.title,
      detail: 'url' in preview ? preview.url : '',
      history: preview.kind === 'browser',
      icon: ['file', 'resource-file', 'snapshot'].includes(preview.kind) ? (
        <File size={16} />
      ) : undefined,
      onSelect: () => onOpenPreview(preview),
    })),
    ...recentFiles.map(({ file }) => ({
      key: `file:${file.filePath}`,
      title: file.filePath.split('/').pop() ?? file.filePath,
      detail: file.filePath,
      icon: <File size={16} />,
      onSelect: () => onOpenFile?.(file),
    })),
    ...views.map((view) => ({
      key: `view:${view.key}`,
      title: label(view),
      detail: description(view),
      icon: icon(view, 16),
      onSelect: () => onSelectView(view.key),
    })),
  ];
  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={getSurfaceThemeStyle(theme)}
    >
      <WorkbenchAddressBar
        value={query}
        onChange={setQuery}
        apiUrl={apiUrl}
        suggestions={suggestions}
        onOpen={onOpenPreview}
        onReload={onReload}
        loading={loading}
        navigation={navigation}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-4xl space-y-9 px-5 py-7 sm:px-8">
          {error && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 text-sm text-destructive"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={onReload}
                className="shrink-0 underline"
              >
                {t('workbench.retry')}
              </button>
            </div>
          )}
          {loading && (
            <div
              role="status"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Loader2 size={16} className="animate-spin" />
              {t('workbench.loading')}
            </div>
          )}
          {search && !matches && !loading && (
            <p role="status" className="text-sm text-muted-foreground">
              {t(
                urlQuery
                  ? 'workbench.start.urlHint'
                  : 'workbench.start.noResults',
              )}
            </p>
          )}
          <section aria-labelledby={`${sectionId}-tools`}>
            <h2
              id={`${sectionId}-tools`}
              className="mb-4 text-sm font-semibold"
            >
              {t('workbench.start.tools')}
            </h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-2">
              {tools.map((tool) => (
                <button
                  key={tool.key}
                  type="button"
                  disabled={tool.disabled}
                  onClick={() => onOpenTool?.(tool.key)}
                  title={
                    tool.disabled
                      ? t(
                          tool.key === 'side-chat' && !sideChatEnabled
                            ? 'workbench.start.disabled'
                            : 'workbench.start.conversationRequired',
                        )
                      : undefined
                  }
                  className="flex min-w-0 items-center gap-3 rounded-[var(--chat-item-radius)] border border-border/60 bg-muted/30 px-4 py-3 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <tool.icon
                    size={19}
                    className="shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {t(
                      `workbench.start.${tool.key === 'side-chat' ? 'sideChat' : tool.key}`,
                    )}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setMoreTools((value) => !value)}
                aria-expanded={moreTools}
                className="flex min-w-0 items-center gap-3 rounded-[var(--chat-item-radius)] border border-border/60 bg-muted/30 px-4 py-3 text-left text-sm hover:bg-muted"
              >
                <Grid2X2 size={19} className="text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  {t('workbench.start.moreTools')}
                </span>
                <ChevronDown
                  size={16}
                  className={moreTools ? 'rotate-180' : ''}
                />
              </button>
            </div>
            {moreTools && (
              <p role="status" className="mt-3 text-sm text-muted-foreground">
                {t('workbench.start.comingSoon')}
              </p>
            )}
          </section>
          <section aria-labelledby={`${sectionId}-dynamic`}>
            <h2
              id={`${sectionId}-dynamic`}
              className="mb-4 text-sm font-semibold"
            >
              {t('workbench.start.dynamic')}
            </h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))] gap-3">
              {dynamic.map((view) => (
                <button
                  key={view.key}
                  type="button"
                  onClick={() => onSelectView(view.key)}
                  className="flex min-w-0 flex-col items-start gap-3 rounded-[var(--chat-panel-radius)] border border-border/60 px-4 py-5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex size-10 items-center justify-center rounded-[var(--chat-item-radius)] bg-muted">
                    {icon(view, 25)}
                  </span>
                  <span className="line-clamp-2 text-sm font-medium">
                    {label(view)}
                  </span>
                  {description(view) && (
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {description(view)}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {!dynamic.length && (
              <p className="text-sm text-muted-foreground">
                {t(
                  search
                    ? 'workbench.start.noResults'
                    : 'workbench.start.noDynamic',
                )}
              </p>
            )}
          </section>
          <section aria-labelledby={`${sectionId}-recent`}>
            <h2
              id={`${sectionId}-recent`}
              className="mb-3 text-sm font-semibold"
            >
              {t('workbench.start.recent')}
            </h2>
            <div className="space-y-1">
              {recentWorkspaceFiles.map(({ file, openedAt }) => (
                <button
                  key={file.filePath}
                  type="button"
                  onClick={() => onOpenFile?.(file)}
                  className="flex w-full min-w-0 items-center gap-3 rounded-[var(--chat-item-radius)] px-3 py-3 text-left hover:bg-muted"
                >
                  <File size={18} className="shrink-0 text-muted-foreground" />
                  <span
                    className="min-w-0 flex-1 truncate text-sm"
                    title={file.filePath}
                  >
                    {file.filePath}
                  </span>
                  <time
                    className="shrink-0 text-xs text-muted-foreground"
                    dateTime={new Date(openedAt).toISOString()}
                  >
                    {date.format(openedAt)}
                  </time>
                </button>
              ))}
              {recentItems.map(({ preview, openedAt }) => (
                <button
                  key={preview.key}
                  type="button"
                  onClick={() => onOpenPreview(preview)}
                  className="flex w-full min-w-0 items-center gap-3 rounded-[var(--chat-item-radius)] px-3 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--chat-item-radius)] bg-muted text-muted-foreground">
                    {['file', 'resource-file', 'snapshot'].includes(
                      preview.kind,
                    ) ? (
                      <File size={18} />
                    ) : (
                      <Globe size={18} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-sm font-medium"
                      title={preview.title}
                    >
                      {preview.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t(
                        preview.kind === 'file'
                          ? 'workbench.start.file'
                          : 'workbench.start.website',
                      )}
                    </span>
                  </span>
                  <time
                    dateTime={new Date(openedAt).toISOString()}
                    className="shrink-0 text-xs text-muted-foreground"
                  >
                    {date.format(openedAt)}
                  </time>
                </button>
              ))}
            </div>
            {!recentItems.length && !recentWorkspaceFiles.length && (
              <p className="text-sm text-muted-foreground">
                {t(
                  search
                    ? 'workbench.start.noResults'
                    : 'workbench.start.noRecent',
                )}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
