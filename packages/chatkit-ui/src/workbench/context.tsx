import * as React from 'react';
import type { ChatKitReference, TMessageContentResourceCard } from '@xpert-ai/chatkit-types';
import { Loader2 } from 'lucide-react';
import {
  WorkbenchViewMenu,
  WorkbenchViewsIcon,
  type WorkbenchViewMenuProps,
} from './WorkbenchViewMenu';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';
import { cn } from '../lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/ui/tooltip';

export type WorkbenchContextValue = {
  openResourceCard?: (card: TMessageContentResourceCard, messageId: string) => Promise<unknown>;
  enabled: boolean;
  open: boolean;
  loading: boolean;
  available: boolean;
  disabledReason?: string;
  toggle: () => void;
  viewMenu?: Omit<WorkbenchViewMenuProps, 'children'>;
  sideChatEnabled: boolean;
  askInSideChat: (reference: ChatKitReference) => Promise<void>;
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
    <button
      type="button"
      onClick={workbench.toggle}
      disabled={!workbench.available}
      className={cn(
        'flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg',
        'text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground data-[state=open]:bg-muted',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
      )}
      aria-label={label}
    >
      {workbench.loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <WorkbenchViewsIcon count={viewMenu?.views.length ?? 0} />
      )}
    </button>
  );

  if (workbench.available && viewMenu?.views.length) {
    return <WorkbenchViewMenu {...viewMenu}>{button}</WorkbenchViewMenu>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex h-8 w-8">
          {button}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
