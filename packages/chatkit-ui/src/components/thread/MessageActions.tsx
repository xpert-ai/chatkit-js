import * as React from 'react';
import {
  Check,
  Copy,
  Pencil,
  RefreshCw,
  GitBranch,
  Loader2,
} from 'lucide-react';
import type { ChatMessageBranching } from '@xpert-ai/xpert-sdk';
import type { ChatkitMessage } from '@xpert-ai/chatkit-types';
import { MessageTimestamp } from './MessageTimestamp';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

type MessageActionButtonProps =
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    tooltip?: string;
    onTooltipOpen?: () => void;
  };

function MessageActionButton({
  label,
  tooltip = label,
  onTooltipOpen,
  disabled,
  className,
  ...props
}: MessageActionButtonProps) {
  const button = (
    <button
      {...props}
      type="button"
      aria-label={label}
      disabled={disabled}
      className={cn(
        'rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
    />
  );

  return (
    <Tooltip
      delayDuration={200}
      onOpenChange={(open) => {
        if (open) onTooltipOpen?.();
      }}
    >
      <TooltipTrigger asChild>
        {disabled ? (
          <span
            tabIndex={0}
            aria-label={label}
            aria-disabled="true"
            className="inline-flex rounded-md"
          >
            {button}
          </span>
        ) : (
          button
        )}
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        sideOffset={8}
        hideArrow
        className="max-w-64 rounded-full bg-zinc-900 px-3 py-2 text-sm text-white shadow-lg"
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export type MessageActionsProps = {
  updatedAt?: ChatkitMessage['updatedAt'];
  content: string;
  isAssistant?: boolean;
  isStreaming?: boolean;
  alwaysVisible?: boolean;
  onRetry?: () => void;
  onEdit?: () => void;
  onBranch?: () => void;
  onActionTooltipOpen?: () => void;
  branching?: ChatMessageBranching;
  isBranching?: boolean;
  branchDisabled?: boolean;
  className?: string;
};

export function MessageActions({
  updatedAt,
  content,
  isAssistant = false,
  isStreaming = false,
  alwaysVisible = false,
  onRetry,
  onEdit,
  onBranch,
  onActionTooltipOpen,
  branching,
  isBranching = false,
  branchDisabled = false,
  className,
}: MessageActionsProps) {
  const { t } = useChatkitTranslation();
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (isStreaming) return null;

  const branchLabel = t('messageActions.branch');
  const branchTooltip = isBranching
    ? t('messageActions.branching')
    : branching && !branching.available
      ? `${branchLabel}：${t(`messageActions.branchReasons.${branching.reason ?? 'checkpoint_unavailable'}`)}`
      : branchLabel;

  return (
    <div className={cn('flex items-center gap-1 mt-2', className)}>
      <div
        className={cn(
          'flex items-center gap-1 opacity-100 transition-opacity',
          !alwaysVisible &&
            'sm:opacity-0 sm:group-hover/message:opacity-100 sm:focus-within:opacity-100',
        )}
      >
        <MessageActionButton
          label={copied ? t('messageActions.copied') : t('messageActions.copy')}
          onClick={handleCopy}
          onTooltipOpen={onActionTooltipOpen}
          className={cn(copied && 'text-green-500')}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </MessageActionButton>
        {!isAssistant && onEdit && (
          <MessageActionButton
            label={t('threadControl.editMessage')}
            onClick={onEdit}
            onTooltipOpen={onActionTooltipOpen}
          >
            <Pencil size={14} />
          </MessageActionButton>
        )}
        {isAssistant && onRetry && (
          <MessageActionButton
            label={t('messageActions.regenerate')}
            onClick={onRetry}
            onTooltipOpen={onActionTooltipOpen}
          >
            <RefreshCw size={14} />
          </MessageActionButton>
        )}
        {isAssistant && onBranch && branching && (
          <MessageActionButton
            label={branchLabel}
            tooltip={branchTooltip}
            onClick={onBranch}
            onTooltipOpen={onActionTooltipOpen}
            disabled={isBranching || branchDisabled || !branching.available}
            aria-busy={isBranching}
          >
            {isBranching ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <GitBranch size={14} />
            )}
          </MessageActionButton>
        )}
      </div>
      <MessageTimestamp updatedAt={updatedAt} />
    </div>
  );
}

export default MessageActions;
