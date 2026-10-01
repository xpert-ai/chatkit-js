import type { TMessageContentComponent } from '@xpert-ai/chatkit-types';
import { ChevronRight } from 'lucide-react';
import * as React from 'react';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { cn } from '../../../lib/utils';
import {
  getToolGroupCategoryCounts,
  TOOL_GROUP_CATEGORY_ORDER,
} from './tool-group/grouping/categories';
import { ToolCallRow } from './tool-group/rows/ToolCallRow';
import { toolStatusConfig } from './tool-group/status/step-status';
import type { ToolStepRunState } from './tool-group/types';

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
  items,
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
  const contentId = React.useId();
  const [isExpanded, setIsExpanded] = React.useState(!hasFollowingItem);
  const categoryCounts = getToolGroupCategoryCounts(items);
  const categorySummary = TOOL_GROUP_CATEGORY_ORDER.flatMap((category) => {
    const count = categoryCounts[category] ?? 0;
    if (count === 0) return [];

    return [
      t(
        `message.toolGroup.categories.${category}.${count === 1 ? 'one' : 'other'}`,
        { count },
      ),
    ];
  }).join(t('message.toolGroup.separator'));
  const summary = `${t('message.toolGroup.status.success')} ${categorySummary}`;
  const config = toolStatusConfig.success;
  const StatusIcon = config.icon;

  React.useEffect(() => {
    setIsExpanded(!hasFollowingItem);
  }, [hasFollowingItem]);

  return (
    <div className="px-1 py-1">
      <button
        type="button"
        className="group/tool-group inline-flex max-w-full items-center gap-1 text-left opacity-60 hover:opacity-100 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground">
          <StatusIcon className={cn('h-4 w-4 shrink-0', config.iconClass)} />
          <span className="truncate">{summary}</span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-[opacity,transform] group-hover/tool-group:opacity-100 group-focus-visible/tool-group:opacity-100',
            isExpanded && 'rotate-90 opacity-100',
          )}
        />
      </button>

      {isExpanded && (
        <ul id={contentId} className="mt-2 space-y-1.5 overflow-y-auto pr-1">
          {items.map((item, index) => (
            <ToolCallRow
              key={item.id ?? `tool-item-${index}`}
              content={item}
              isThreadRunning={isThreadRunning}
              isThreadPaused={isThreadPaused}
              organizationId={organizationId}
              apiUrl={apiUrl}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
