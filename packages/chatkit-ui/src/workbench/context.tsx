import * as React from 'react';
import type {
  ArtifactIdentity,
  ArtifactOpenOptions,
} from './artifact-preview/artifact-preview';
import type { ConversationResourceTarget } from '@xpert-ai/xpert-sdk';
import type {
  ChatKitReference,
  FileChangeResource,
  FileChangeSetResource,
} from '@xpert-ai/chatkit-types';
import { Loader2 } from 'lucide-react';
import {
  WorkbenchViewMenu,
  WorkbenchViewsIcon,
  type WorkbenchViewMenuProps,
} from './WorkbenchViewMenu';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';
import { ToolbarButton } from '../components/ui/toolbar-button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/ui/tooltip';

import type { PresentationWorkbenchPreview } from './preview/types';

export type WorkbenchContextValue = {
  openScheduleForm?: (threadId: string, title: string) => void;
  /** Resolve a conversation-scoped resource afresh; metadata never bypasses its native authorization. */
  openResource?: (
    resource: ConversationResourceTarget,
    options?: { signal?: AbortSignal },
  ) => Promise<unknown>;
  openPresentation?: (preview: PresentationWorkbenchPreview) => void;
  closePresentation?: (key: string) => void;
  openGroupAssistant?: (target: {
    messageId: string;
    participantId: string;
  }) => void;
  openProject?: (projectId: string, viewKey: string) => Promise<unknown>;
  openArtifact?: (
    resource: ArtifactIdentity,
    options: ArtifactOpenOptions,
  ) => boolean;
  openHtmlArtifact?: (
    resource: { artifactId: string; artifactVersionId: string },
    title: string,
  ) => boolean;
  openFileReview?: (
    resource: FileChangeResource | FileChangeSetResource,
  ) => boolean;
  enabled: boolean;
  open: boolean;
  loading: boolean;
  available: boolean;
  disabledReason?: string;
  toggle: () => void;
  viewMenu?: Omit<WorkbenchViewMenuProps, 'children'>;
  sideChatEnabled: boolean;
  askInSideChat: (reference?: ChatKitReference) => Promise<void>;
  externalAssistantsEnabled?: boolean;
  openExternalAssistant?: (executionId: string) => void;
};

export const disabledWorkbenchContext: WorkbenchContextValue = {
  enabled: false,
  open: false,
  loading: false,
  available: false,
  toggle: () => undefined,
  sideChatEnabled: false,
  askInSideChat: async () => undefined,
};
export const WorkbenchContext = React.createContext<WorkbenchContextValue>(
  disabledWorkbenchContext,
);

export function useWorkbench() {
  return React.useContext(WorkbenchContext);
}

export function WorkbenchToggleButton() {
  const workbench = useWorkbench();
  const { t } = useChatkitTranslation();
  if (!workbench.enabled || workbench.open) return null;

  const label = t('workbench.open');
  const tooltip = workbench.disabledReason ?? label;
  const viewMenu = workbench.viewMenu;
  const button = (
    <ToolbarButton
      type="button"
      onClick={workbench.toggle}
      disabled={!workbench.available}
      className="data-[state=open]:bg-muted"
      aria-label={label}
    >
      {workbench.loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <WorkbenchViewsIcon count={viewMenu?.views.length ?? 0} />
      )}
    </ToolbarButton>
  );

  if (workbench.available && viewMenu?.views.length) {
    return <WorkbenchViewMenu {...viewMenu}>{button}</WorkbenchViewMenu>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{button}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
