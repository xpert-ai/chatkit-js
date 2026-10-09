import * as React from 'react';
import type {
  Client,
  WorkspaceFileScope,
  XpertWorkspaceFile,
} from '@xpert-ai/xpert-sdk';
import { File, Folder, Terminal } from 'lucide-react';
import { WorkbenchTab } from '../WorkbenchTab';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type { NativeTab, FileEditorHandle } from './useNativeWorkbench';
import { WorkspaceFiles, fileName } from './files/WorkspaceFiles';
import { WorkspaceFileEditor } from './files/WorkspaceFileEditor';
import { NativeViewBoundary } from './NativeViewBoundary';
import {
  terminalRestrictionMessage,
  type TerminalRestriction,
} from './terminal/terminal-restriction';
const WorkbenchTerminal = React.lazy(
  () => import('./terminal/WorkbenchTerminal'),
);

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
          <WorkbenchTab
            key={tab.key}
            label={title}
            icon={<Icon size={16} />}
            selected={activeKey === tab.key}
            id={tab.key}
            panelId={`${tab.key}-panel`}
            onSelect={() => onSelect(tab.key)}
            close={{
              label: t('workbench.files.close', { name: title }),
              onClick: () => onClose(tab.key),
            }}
          >
            {dirty.includes(tab.key) && (
              <span aria-label={t('workbench.files.unsavedLabel')}>•</span>
            )}
          </WorkbenchTab>
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
  terminalUnavailable,
  onTerminalUnavailable,
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
  terminalUnavailable?: TerminalRestriction | null;
  onTerminalUnavailable?: (reason: TerminalRestriction) => void;
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
          <NativeViewBoundary>
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
              ) : tab.kind === 'terminal' && terminalUnavailable ? (
                <div role="status" className="space-y-2 p-6 text-sm">
                  <p className="font-medium">
                    {t('workbench.files.terminalUnavailable')}
                  </p>
                  <p className="text-muted-foreground">
                    {t(terminalRestrictionMessage[terminalUnavailable])}
                  </p>
                </div>
              ) : tab.kind === 'terminal' ? (
                <WorkbenchTerminal
                  client={client}
                  conversationId={conversationId}
                  projectId={projectId}
                  active={visible && tab.key === activeKey}
                  onUnavailable={onTerminalUnavailable}
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
          </NativeViewBoundary>
        </div>
      ))}
    </>
  );
}
