import type { TMessageContentComponent } from '@xpert-ai/chatkit-types';
import { ChevronRight } from 'lucide-react';
import * as React from 'react';
import { useChatkitTranslation } from '../../../../../i18n/useChatkitTranslation';
import { cn } from '../../../../../lib/utils';
import { getComponentMessageRenderer } from '../../component-message-renderers';
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
import { useToolDisclosure } from '../status/useToolDisclosure';
import { useToolStepDurationLabel } from '../status/useToolStepDuration';
import type { ToolStepRunState } from '../types';

const TOOL_CALL_ROW_TEXT_CLASS =
  'text-xs leading-5 in-data-[density=compact]:text-[11px] in-data-[density=compact]:leading-4 in-data-[density=spacious]:text-[13px] in-data-[density=spacious]:leading-5';

type ToolCallRowProps = {
  content: TMessageContentComponent;
  isThreadRunning?: ToolStepRunState;
  isThreadPaused?: boolean;
  organizationId?: string;
  apiUrl?: string;
  onInteract?: () => void;
  isGroupExpanded?: boolean;
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
    previous.apiUrl === next.apiUrl &&
    previous.onInteract === next.onInteract &&
    previous.isGroupExpanded === next.isGroupExpanded
  );
}

function ToolCallRowContent({
  content,
  isThreadRunning,
  isThreadPaused,
  organizationId,
  apiUrl,
  onInteract,
  isGroupExpanded = true,
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
  const label =
    isSandboxShell && !data.presentation
      ? getSandboxShellActivityLabel(
          data,
          status === 'unknown' ? undefined : status,
          i18n.language,
          t,
        )
      : (renderer?.getTitle?.(content, data, i18n.language) ??
        getToolActivityLabel(content, i18n.language, status));

  const durationLabel = useToolStepDurationLabel(data, {
    status,
    isPaused,
  });
  const [isExpanded, toggleExpanded] = useToolDisclosure(hasError);
  const stateLabel = t(
    `message.toolGroup.callStatus.${isPaused ? 'paused' : hasError ? 'fail' : (status ?? 'running')}`,
  );
  const inputPreview = data.presentation?.target;

  return (
    <li className="ck-tool-call-row-enter min-w-0">
      <button
        type="button"
        className={cn(
          'group/tool-call flex min-h-6 w-full min-w-0 items-center gap-2 rounded-chat-item text-left text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          TOOL_CALL_ROW_TEXT_CLASS,
          hasError &&
            !isSandboxShell &&
            'text-destructive hover:text-destructive',
        )}
        aria-expanded={isExpanded}
        aria-controls={detailsId}
        onClick={() => {
          toggleExpanded();
          onInteract?.();
        }}
      >
        {status ? (
          <ToolStepIcon
            data={data}
            animated={
              status === 'running' && !isPaused && !hasError && isGroupExpanded
            }
            organizationId={organizationId}
            apiUrl={apiUrl}
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              hasError ? 'text-destructive' : 'text-muted-foreground',
            )}
          />
        ) : (
          <span className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <span
            className={cn(
              'min-w-0 truncate',
              status === 'running' && !isPaused && 'ck-tool-call-running-text',
            )}
            title={label}
          >
            {label}
          </span>
          {inputPreview && (
            <code className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
              {inputPreview}
            </code>
          )}
        </span>
        <span
          className={cn(
            'ml-auto shrink-0 text-[11px]',
            hasError ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {stateLabel}
        </span>
        {durationLabel ? (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/80">
            {durationLabel}
          </span>
        ) : null}
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
            isExpanded && 'rotate-90',
          )}
        />
      </button>
      <div
        id={detailsId}
        hidden={!isExpanded}
        role="region"
        aria-label={t('message.toolGroup.detailsTitle')}
        tabIndex={0}
      >
        {isExpanded && (
          <ToolCallDetails
            content={content}
            isThreadPaused={isThreadPaused}
            status={status}
          />
        )}
      </div>
    </li>
  );
}

export const ToolCallRow = React.memo(
  ToolCallRowContent,
  areToolCallRowPropsEqual,
);

ToolCallRow.displayName = 'ToolCallRow';
