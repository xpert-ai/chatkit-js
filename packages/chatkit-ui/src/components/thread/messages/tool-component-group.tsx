import type { TMessageContentComponent } from '@xpert-ai/chatkit-types';
import { ChevronRight } from 'lucide-react';
import * as React from 'react';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { cn } from '../../../lib/utils';
import {
  distinctToolCalls,
  toolCallIdentity,
  toolGroupActivity,
  toolGroupActivityTitle,
} from './tool-group/grouping/activities';
import {
  MixedToolActivityIcon,
  UnknownToolActivityIcon,
  toolActivityIcons,
} from './tool-group/icons/activity-icons';
import { ToolCallRow } from './tool-group/rows/ToolCallRow';
import { CommandToolIcon } from './tool-group/icons/CommandToolIcon';
import type { ToolStepRunState } from './tool-group/types';
import { getToolGroupStatus } from './tool-group/status/group-status';
import { useToolDisclosure } from './tool-group/status/useToolDisclosure';

export { getToolActivityLabel } from './tool-group/grouping/categories';
export { buildToolComponentRenderUnits } from './tool-group/grouping/render-units';
export {
  getEffectiveToolStepStatus,
  getToolStepData,
  isPausedToolStep,
  toolStatusConfig,
} from './tool-group/status/step-status';
export {
  type PartialStepData,
  type ToolComponentRenderUnit,
} from './tool-group/types';

export function ToolComponentGroup({
  items: updates,
  hasFollowingItem,
  isThreadRunning,
  isThreadPaused,
  organizationId,
  apiUrl,
}: {
  items: TMessageContentComponent[];
  hasFollowingItem: boolean;
  isThreadRunning?: ToolStepRunState;
  isThreadPaused?: boolean;
  organizationId?: string;
  apiUrl?: string;
}) {
  const { t } = useChatkitTranslation();
  const items = React.useMemo(() => distinctToolCalls(updates), [updates]);
  const contentId = React.useId();
  const { status, paused, failedCount } = getToolGroupStatus(
    items,
    isThreadRunning,
    isThreadPaused,
  );
  const [isExpanded, toggleExpanded, setExpanded] = useToolDisclosure(
    !hasFollowingItem || failedCount > 0,
  );
  const retainGroup = React.useCallback(() => setExpanded(true), [setExpanded]);
  const activity = toolGroupActivity(items);
  const summary = toolGroupActivityTitle(activity, t);
  const ActivityIcon = activity.kind
    ? toolActivityIcons[activity.kind]
    : activity.kinds.length
      ? MixedToolActivityIcon
      : UnknownToolActivityIcon;

  return (
    <div data-tool-timeline className="px-1 py-1">
      <button
        type="button"
        className="group/tool-group inline-flex min-h-7 max-w-full items-center gap-2 rounded-chat-item text-left text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        onClick={toggleExpanded}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-muted-foreground">
          {activity.kind === 'command' ? (
            <CommandToolIcon
              className="h-4 w-4 shrink-0"
              animated={status === 'running' && !paused && !isExpanded}
            />
          ) : (
            <ActivityIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate">{summary}</span>
          <span className="shrink-0 text-xs">
            · {t('message.toolGroup.callCount', { count: items.length })}
          </span>
          <span
            className={cn(
              'shrink-0 text-xs',
              status === 'running' && 'ck-tool-call-running-text',
            )}
          >
            {t(
              paused
                ? 'message.toolGroup.paused'
                : `message.toolGroup.status.${status}`,
            )}
          </span>
          {failedCount > 0 && (
            <span className="shrink-0 text-xs text-destructive">
              {t('message.toolGroup.failedCount', { count: failedCount })}
            </span>
          )}
        </span>
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
            isExpanded && 'rotate-90',
          )}
        />
      </button>

      <ul
        id={contentId}
        hidden={!isExpanded}
        className="ml-2 mt-2 space-y-2 border-l border-border/70 py-1 pl-4 in-data-[density=compact]:space-y-1 in-data-[density=compact]:pl-3 in-data-[density=spacious]:space-y-3"
      >
        {items.map((item, index) => (
          <ToolCallRow
            key={toolCallIdentity(item) || `tool-item-${index}`}
            content={item}
            isThreadRunning={isThreadRunning}
            isThreadPaused={isThreadPaused}
            organizationId={organizationId}
            apiUrl={apiUrl}
            onInteract={retainGroup}
            isGroupExpanded={isExpanded}
          />
        ))}
      </ul>
    </div>
  );
}
