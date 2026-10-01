import {
  ChevronDown,
  Loader2,
  Pause,
  Pencil,
  Play,
  Target,
  Trash2,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Button } from '../../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';
import type { useChatDraft } from '../composer/useChatDraft';
import type { useChatEnvironment } from '../session/useChatEnvironment';
import { formatGoalElapsed } from './goal-utils';
import type { useChatGoal } from './useChatGoal';

type ChatGoalStatusProps = Pick<
  ReturnType<typeof useChatGoal>,
  | 'showGoalStatus'
  | 'isGoalObjectiveExpanded'
  | 'threadGoal'
  | 'isGoalLoading'
  | 'goalError'
  | 'displayedGoalElapsedSeconds'
  | 'handleGoalCommand'
  | 'setIsGoalObjectiveExpanded'
> &
  Pick<ReturnType<typeof useChatEnvironment>, 't'> &
  Pick<ReturnType<typeof useChatDraft>, 'setComposerText'>;

export function ChatGoalStatus({
  showGoalStatus,
  isGoalObjectiveExpanded,
  t,
  threadGoal,
  isGoalLoading,
  goalError,
  displayedGoalElapsedSeconds,
  setComposerText,
  handleGoalCommand,
  setIsGoalObjectiveExpanded,
}: ChatGoalStatusProps) {
  return (
    showGoalStatus && (
      <div
        className={cn(
          'mb-2 flex min-h-10 gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-xs text-foreground shadow-sm',
          isGoalObjectiveExpanded ? 'items-start' : 'items-center',
        )}
      >
        <Target
          className={cn(
            'size-4 shrink-0 text-muted-foreground',
            isGoalObjectiveExpanded && 'mt-1',
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-medium">{t('chat.goal.label')}</span>
            {threadGoal && (
              <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {t(`chat.goal.status.${threadGoal.status}`)}
              </span>
            )}
            {isGoalLoading && (
              <Loader2 className="size-3 animate-spin text-muted-foreground" />
            )}
          </div>
          <div
            className={cn(
              'mt-0.5 text-muted-foreground',
              threadGoal?.objective && !goalError && isGoalObjectiveExpanded
                ? 'whitespace-pre-wrap break-words'
                : 'truncate',
            )}
          >
            {goalError || threadGoal?.objective}
          </div>
          {threadGoal && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>
                {t('chat.goal.elapsed', {
                  elapsed: formatGoalElapsed(displayedGoalElapsedSeconds),
                })}
              </span>
            </div>
          )}
        </div>
        {threadGoal && (
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={isGoalLoading}
                  onClick={() => {
                    const prefix = '/goal edit ';
                    setComposerText(`${prefix}${threadGoal.objective}`);
                  }}
                >
                  <Pencil className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('chat.goal.edit')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={isGoalLoading}
                  onClick={() =>
                    void handleGoalCommand({
                      args: threadGoal.status === 'paused' ? 'resume' : 'pause',
                      commandSource: {
                        type: 'slash_command',
                        name: 'goal',
                        source: 'runtime',
                        executionType: 'insert_invocation',
                      },
                    })
                  }
                >
                  {threadGoal.status === 'paused' ? (
                    <Play className="size-3" />
                  ) : (
                    <Pause className="size-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {threadGoal.status === 'paused'
                  ? t('chat.goal.resume')
                  : t('chat.goal.pause')}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={isGoalLoading}
                  onClick={() =>
                    void handleGoalCommand({
                      args: 'clear',
                      commandSource: {
                        type: 'slash_command',
                        name: 'goal',
                        source: 'runtime',
                        executionType: 'insert_invocation',
                      },
                    })
                  }
                >
                  <Trash2 className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('chat.goal.clear')}</TooltipContent>
            </Tooltip>
            {threadGoal.objective && !goalError && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-expanded={isGoalObjectiveExpanded}
                    aria-label={
                      isGoalObjectiveExpanded
                        ? t('chat.goal.collapseObjective')
                        : t('chat.goal.expandObjective')
                    }
                    onClick={() =>
                      setIsGoalObjectiveExpanded((expanded) => !expanded)
                    }
                  >
                    <ChevronDown
                      className={cn(
                        'size-3 transition-transform',
                        isGoalObjectiveExpanded && 'rotate-180',
                      )}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isGoalObjectiveExpanded
                    ? t('chat.goal.collapseObjective')
                    : t('chat.goal.expandObjective')}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    )
  );
}
