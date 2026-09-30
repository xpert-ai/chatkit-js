import * as React from 'react';
import type {
  Client,
  WorkspaceFileScope,
  XpertWorkspaceFile,
} from '@xpert-ai/xpert-sdk';
import { File, Folder, Terminal, X } from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type { NativeTab, FileEditorHandle } from './useNativeWorkbench';
import { WorkspaceFiles, fileName } from './WorkspaceFiles';
import { WorkspaceFileEditor } from './WorkspaceFileEditor';
const WorkbenchTerminal = React.lazy(() => import('./WorkbenchTerminal'));

export function NativeWorkbenchTabs({
  tabs,
  activeKey,
  dirty,
  onSelect,
  onClose,
}: {
  tabs: NativeTab[];
  activeKey: string | null;
  dirty: string[];
  onSelect: (key: string) => void;
  onClose: (key: string) => void;
}) {
  const { t } = useChatkitTranslation();
  return (
    <>
      {tabs.map((tab) => {
        const title =
          tab.kind === 'files'
            ? tab.preview
              ? fileName(tab.preview.filePath)
              : t('workbench.files.openFile')
            : tab.kind === 'file'
              ? fileName(tab.file.filePath)
              : t(`workbench.start.${tab.kind}`);
        const Icon =
          tab.kind === 'files' && !tab.preview
            ? Folder
            : tab.kind === 'terminal'
              ? Terminal
              : File;
        return (
          <div
            key={tab.key}
            className={`flex h-9 max-w-56 shrink-0 items-center rounded-[var(--chat-item-radius)] ${activeKey === tab.key ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60'}`}
          >
            <button
              type="button"
              role="tab"
              id={tab.key}
              aria-controls={`${tab.key}-panel`}
              aria-selected={activeKey === tab.key}
              className="flex h-full min-w-0 items-center gap-2 px-3 text-sm font-medium"
              onClick={() => onSelect(tab.key)}
            >
              <Icon size={16} className="shrink-0" />
              <span className="truncate">{title}</span>
              {dirty.includes(tab.key) && (
                <span aria-label={t('workbench.files.unsavedLabel')}>•</span>
              )}
            </button>
            <button
              type="button"
              className="mr-1 rounded-[var(--chat-item-radius)] p-1 hover:bg-background/80"
              aria-label={t('workbench.files.close', { name: title })}
              onClick={() => onClose(tab.key)}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </>
  );
}
export function NativeWorkbenchContent({
  tabs,
  activeKey,
  visible,
  client,
  scope,
  conversationId,
  projectId,
  register,
  onOpenFile,
  revision,
  onSaved,
  onPreviewFile,
}: {
  tabs: NativeTab[];
  activeKey: string | null;
  visible: boolean;
  client: Client;
  scope: WorkspaceFileScope | null;
  conversationId?: string | null;
  projectId?: string | null;
  register: (key: string, handle: FileEditorHandle | null) => void;
  onOpenFile: (file: XpertWorkspaceFile) => void;
  revision: number;
  onSaved: () => void;
  onPreviewFile?: (file: XpertWorkspaceFile | null) => void;
}) {
  const { t } = useChatkitTranslation();
  return (
    <>
      {tabs.map((tab) => (
        <div
          key={tab.key}
          id={`${tab.key}-panel`}
          role="tabpanel"
          aria-labelledby={tab.key}
          hidden={tab.key !== activeKey}
          className="h-full min-h-0"
        >
          <React.Suspense
            fallback={
              <p className="p-6 text-sm text-muted-foreground">
                {t('workbench.loading')}
              </p>
            }
          >
            {tab.kind === 'files' ? (
              <WorkspaceFiles
                client={client}
                scope={scope}
                onOpen={onOpenFile}
                onPreview={onPreviewFile}
                revision={revision}
              />
            ) : tab.kind === 'terminal' ? (
              <WorkbenchTerminal
                client={client}
                conversationId={conversationId}
                projectId={projectId}
                active={visible && tab.key === activeKey}
              />
            ) : scope ? (
              <WorkspaceFileEditor
                client={client}
                scope={scope}
                file={tab.file}
                tabKey={tab.key}
                register={register}
                onSaved={onSaved}
              />
            ) : null}
          </React.Suspense>
        </div>
      ))}
    </>
  );
}
