import type { TMessageContentComponent } from '@xpert-ai/chatkit-types';
import { ChevronRight } from 'lucide-react';
import * as React from 'react';
import { useChatkitTranslation } from '../../../../../i18n/useChatkitTranslation';
import { cn } from '../../../../../lib/utils';
import {
  getComponentMessageRenderer,
  hasComponentMessageRendererDetails,
} from '../../component-message-renderers';
import {
  getSandboxShellActivityLabel,
  isSandboxShellStep,
} from '../../sandbox-shell-tool-call';
import { ToolCallDetails } from '../details/ToolCallDetails';
import { getToolActivityLabel } from '../grouping/categories';
import { ToolStepIcon } from '../icons/ToolStepIcon';
import {
  getEffectiveToolStepStatus,
  getToolStepData,
  isPausedToolStep,
} from '../status/step-status';
import {
  useFrozenTimestamp,
  useToolStepDurationLabel,
} from '../status/useToolStepDuration';
import type { ToolStepRunState } from '../types';

const TOOL_CALL_ROW_TEXT_CLASS =
  'text-xs leading-5 in-data-[density=compact]:text-[11px] in-data-[density=compact]:leading-4 in-data-[density=spacious]:text-[13px] in-data-[density=spacious]:leading-5';

type ToolCallRowProps = {
  content: TMessageContentComponent;
  isThreadRunning?: ToolStepRunState;
  isThreadPaused?: boolean;
  organizationId?: string;
  apiUrl?: string;
};

function areToolCallRowPropsEqual(
  previous: ToolCallRowProps,
  next: ToolCallRowProps,
) {
  return (
    previous.content.id === next.content.id &&
    previous.content.data === next.content.data &&
    previous.isThreadRunning === next.isThreadRunning &&
    previous.isThreadPaused === next.isThreadPaused &&
    previous.organizationId === next.organizationId &&
    previous.apiUrl === next.apiUrl
  );
}

function ToolCallRowContent({
  content,
  isThreadRunning,
  isThreadPaused,
  organizationId,
  apiUrl,
}: ToolCallRowProps) {
  const { i18n, t } = useChatkitTranslation();
  const data = getToolStepData(content);
  const isPaused = isPausedToolStep(data, isThreadPaused);
  const status = getEffectiveToolStepStatus(
    data,
    isThreadRunning,
    isThreadPaused,
  );
  const hasError = status === 'fail' || Boolean(data.error);
  const isSandboxShell = isSandboxShellStep(data);
  const detailsId = React.useId();
  const renderer = getComponentMessageRenderer(content, data);
  const label = isSandboxShell
    ? getSandboxShellActivityLabel(data, status, i18n.language, t)
    : (renderer?.getTitle?.(content, data, i18n.language) ??
      getToolActivityLabel(content, i18n.language, status));

  const hasCustomDetails =
    data.error === undefined &&
    hasComponentMessageRendererDetails(renderer, content, data);
  const hasDetails =
    isSandboxShell ||
    data.input !== undefined ||
    data.error !== undefined ||
    data.output !== undefined ||
    data.artifact !== undefined ||
    hasCustomDetails;
  const fallbackEndedAt = useFrozenTimestamp(
    data.status === 'running' && (status === 'fail' || isPaused),
  );
  const durationLabel = useToolStepDurationLabel(data, {
    status,
    fallbackEndedAt,
    isPaused,
  });
  const [isExpanded, setIsExpanded] = React.useState(false);

  React.useEffect(() => {
    if (
      status === 'running' &&
      (data.output !== undefined || data.artifact !== undefined)
    ) {
      setIsExpanded(true);
    }
  }, [data.artifact, data.output, status]);

  return (
    <li className="ck-tool-call-row-enter min-w-0">
      <button
        type="button"
        className={cn(
          'group/tool-call flex w-full min-w-0 items-center gap-2 text-left text-muted-foreground',
          TOOL_CALL_ROW_TEXT_CLASS,
          hasDetails && 'cursor-pointer hover:text-foreground',
          hasError &&
            !isSandboxShell &&
            'text-destructive hover:text-destructive',
        )}
        aria-expanded={hasDetails ? isExpanded : undefined}
        aria-controls={hasDetails ? detailsId : undefined}
        disabled={!hasDetails}
        onClick={() => {
          if (hasDetails) setIsExpanded((prev) => !prev);
        }}
      >
        {status ? (
          <ToolStepIcon
            data={data}
            organizationId={organizationId}
            apiUrl={apiUrl}
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              hasError && !isSandboxShell
                ? 'text-destructive'
                : 'text-muted-foreground',
            )}
          />
        ) : (
          <span className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        <span
          className={cn(
            'min-w-0 truncate',
            status === 'running' && !isPaused && 'ck-tool-call-running-text',
          )}
          title={label}
        >
          {label}
        </span>
        {durationLabel ? (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/80">
            {durationLabel}
          </span>
        ) : null}
        {hasDetails ? (
          <ChevronRight
            aria-hidden="true"
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-[opacity,transform] group-hover/tool-call:opacity-100 group-focus-visible/tool-call:opacity-100',
              isExpanded && 'rotate-90',
            )}
          />
        ) : null}
      </button>
      {hasDetails && isExpanded ? (
        <div id={detailsId}>
          <ToolCallDetails content={content} isThreadPaused={isThreadPaused} />
        </div>
      ) : null}
    </li>
  );
}

export const ToolCallRow = React.memo(
  ToolCallRowContent,
  areToolCallRowPropsEqual,
);

ToolCallRow.displayName = 'ToolCallRow';
