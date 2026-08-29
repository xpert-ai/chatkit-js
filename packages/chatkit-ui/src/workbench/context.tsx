import * as React from 'react';
import type { ChatKitReference } from '@xpert-ai/chatkit-types';
import { Loader2, PanelRight } from 'lucide-react';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';
import { cn } from '../lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/ui/tooltip';

export type WorkbenchContextValue = {
  enabled: boolean;
  open: boolean;
  loading: boolean;
  available: boolean;
  disabledReason?: string;
  toggle: () => void;
  sideChatEnabled: boolean;
  askInSideChat: (reference: ChatKitReference) => Promise<void>;
};

export const WorkbenchContext = React.createContext<WorkbenchContextValue>({
  enabled: false,
  open: false,
  loading: false,
  available: false,
  toggle: () => undefined,
  sideChatEnabled: false,
  askInSideChat: async () => undefined,
});

export function useWorkbench() {
  return React.useContext(WorkbenchContext);
}

export function WorkbenchToggleButton() {
  const workbench = useWorkbench();
  const { t } = useChatkitTranslation();
  if (!workbench.enabled || workbench.open) return null;

  const label = t('workbench.open');
  const tooltip = workbench.disabledReason ?? label;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex h-8 w-8">
          <button
            type="button"
            onClick={workbench.toggle}
            disabled={!workbench.available}
            className={cn(
              'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md',
              'text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground',
              'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
            )}
            aria-label={label}
            aria-expanded={false}
          >
            {workbench.loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <PanelRight size={16} />
            )}
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
