import * as React from 'react';
import { File, Globe, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import type {
  XpertExtensionViewManifest,
  XpertWorkspaceFile,
} from '@xpert-ai/xpert-sdk';
import type {
  NativeTool,
  RecentWorkspaceFile,
} from '../native/useNativeWorkbench';
import type { TerminalRestriction } from '../native/terminal/terminal-restriction';
import type { WorkbenchPreview } from '../preview/types';
import type { RecentWorkbenchPreview } from '../useWorkbenchPages';
import {
  WorkbenchAddressBar,
  type BrowserNavigation,
  type AddressSuggestion,
} from '../browser-preview/WorkbenchAddressBar';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { useWorkbench } from '../context';
import { launcherActions } from './launcher-registry';
import { LauncherMenu, useLauncherPins } from './LauncherMenu';

export function WorkbenchStartPage({
  navigation,
  openTabs = [],
  views,
  openedViewKeys = [],
  recentFiles = [],
  onOpenTool,
  onOpenFile,
  conversationReady = false,
  terminalUnavailable,
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
  openTabs?: AddressSuggestion[];
  views: XpertExtensionViewManifest[];
  openedViewKeys?: string[];
  recentFiles?: RecentWorkspaceFile[];
  onOpenTool?: (tool: NativeTool) => void;
  onOpenFile?: (file: XpertWorkspaceFile) => void;
  conversationReady?: boolean;
  terminalUnavailable?: TerminalRestriction | null;
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
  const workbench = useWorkbench();
  const [query, setQuery] = React.useState('');
  const actions = launcherActions({
    views,
    openedViewKeys,
    locale,
    conversationReady,
    terminalUnavailable,
    sideChatEnabled,
    sideChatOpening: workbench.sideChats?.opening,
    onOpenTool,
    onSelectView,
    t,
  });
  const { pins, save } = useLauncherPins(workbench.storageScope, actions);
  const needle = query.trim().toLocaleLowerCase(locale);
  const visible = actions.filter((a) =>
    `${a.title} ${a.description ?? ''}`
      .toLocaleLowerCase(locale)
      .includes(needle),
  );
  const shortcuts = needle
    ? visible
    : pins.flatMap((id) => actions.find((a) => a.id === id) ?? []);
  const suggestions: AddressSuggestion[] = [
    ...openTabs,
    ...actions.map((a) => ({
      key: a.id,
      title: a.title,
      detail: a.reason ?? a.description,
      icon: a.icon,
      kind: 'action' as const,
      disabled: a.disabled,
      opened: a.opened,
      onSelect: a.run,
    })),
    ...(workbench.sideChats?.sessions ?? []).map((session) => ({
      key: `side:${session.threadId}`,
      title: session.title,
      kind: 'chat' as const,
      opened: session.opened,
      icon: <MessageSquare size={16} />,
      onSelect: () => {
        void workbench.sideChats?.openSideChat(session.threadId);
      },
    })),
    ...recent.map(({ preview, openedAt }) => ({
      key: preview.key,
      title: preview.title,
      detail: 'url' in preview ? preview.url : '',
      history: preview.kind === 'browser',
      kind:
        preview.kind === 'browser' ? ('website' as const) : ('file' as const),
      updatedAt: openedAt,
      onSelect: () => onOpenPreview(preview),
    })),
    ...recentFiles.map(({ file, openedAt }) => ({
      key: `file:${file.filePath}`,
      title: file.filePath.split('/').pop() ?? file.filePath,
      detail: file.filePath,
      icon: <File size={16} />,
      kind: 'file' as const,
      updatedAt: openedAt,
      onSelect: () => onOpenFile?.(file),
    })),
  ];
  const recentMatches = recent.filter(({ preview }) =>
    `${preview.title} ${'url' in preview ? preview.url : ''}`
      .toLocaleLowerCase(locale)
      .includes(needle),
  );
  const fileMatches = recentFiles.filter(({ file }) =>
    file.filePath.toLocaleLowerCase(locale).includes(needle),
  );
  const sectionId = React.useId();
  const tile =
    'flex min-w-0 flex-col items-start gap-[calc(1rem*var(--chat-density-scale,1))] rounded-chat-panel bg-muted/60 p-[calc(1.25rem*var(--chat-density-scale,1))] text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="mx-auto w-full max-w-4xl px-[calc(1.5rem*var(--chat-density-scale,1))] py-[clamp(2rem,12vh,8rem)]">
        <WorkbenchAddressBar
          variant="start"
          value={query}
          onChange={setQuery}
          apiUrl={apiUrl}
          suggestions={suggestions}
          onOpen={onOpenPreview}
          onReload={onReload}
          loading={loading}
          navigation={navigation}
        />
        {error && (
          <div
            role="alert"
            className="mt-4 flex gap-3 text-sm text-destructive"
          >
            {error}
            <button type="button" className="underline" onClick={onReload}>
              {t('workbench.retry')}
            </button>
          </div>
        )}
        {loading && (
          <p
            role="status"
            className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2 size={16} className="animate-spin" />
            {t('workbench.loading')}
          </p>
        )}
        <section
          aria-labelledby={`${sectionId}-tools`}
          className="mt-[calc(2rem*var(--chat-density-scale,1))]"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2
              id={`${sectionId}-tools`}
              className="text-sm text-muted-foreground"
            >
              {t('workbench.start.tools')}
            </h2>
            <div className="flex items-center gap-1">
              {!navigation?.canBack && !navigation?.canForward && (
                <button
                  type="button"
                  aria-label={t('workbench.browser.reload')}
                  disabled={loading}
                  onClick={onReload}
                  className="rounded-chat-item p-[calc(0.5rem*var(--chat-density-scale,1))] text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  <RefreshCw
                    size={16}
                    className={loading ? 'animate-spin' : undefined}
                  />
                </button>
              )}
              <LauncherMenu actions={actions} pins={pins} save={save} />
            </div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-[calc(0.75rem*var(--chat-density-scale,1))]">
            {shortcuts.map((action) => (
              <button
                key={action.id}
                type="button"
                className={tile}
                disabled={action.disabled}
                title={action.reason}
                onClick={action.run}
              >
                {action.icon}
                <span className="w-full truncate">{action.title}</span>
                {action.reason && (
                  <span className="text-xs text-muted-foreground">
                    {action.reason}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
        <section aria-labelledby={`${sectionId}-recent`} className="mt-8">
          <h2
            id={`${sectionId}-recent`}
            className="mb-3 text-sm text-muted-foreground"
          >
            {t('workbench.start.recent')}
          </h2>
          {fileMatches.map(({ file }) => (
            <button
              key={file.filePath}
              type="button"
              className="flex w-full items-center gap-3 rounded-chat-item p-3 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onOpenFile?.(file)}
            >
              <File size={16} className="shrink-0" />
              <span className="truncate" title={file.filePath}>
                {file.filePath}
              </span>
            </button>
          ))}
          {recentMatches.map(({ preview }) => (
            <button
              key={preview.key}
              aria-label={`${preview.title} ${t(preview.kind === 'browser' ? 'workbench.start.website' : 'workbench.start.file')}`}
              type="button"
              className="flex w-full items-center gap-3 rounded-chat-item p-3 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onOpenPreview(preview)}
            >
              {preview.kind === 'browser' ? (
                <Globe size={16} className="shrink-0" />
              ) : (
                <File size={16} className="shrink-0" />
              )}
              <span className="min-w-0 truncate" title={preview.title}>
                {preview.title}
              </span>
              {'url' in preview && (
                <span className="min-w-0 truncate text-muted-foreground">
                  {preview.url}
                </span>
              )}
            </button>
          ))}
          {!recentMatches.length && !fileMatches.length && (
            <p className="text-sm text-muted-foreground">
              {t(
                needle
                  ? 'workbench.start.noResults'
                  : 'workbench.start.noRecent',
              )}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
