import * as React from 'react';

import {
  resolveLocalizedText,
  type LocalizedText,
  type TMessageContentComponent,
} from '@xpert-ai/chatkit-types';
import { FileText, Loader2, XCircle } from 'lucide-react';

import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { cn } from '../../../lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';

export const CONTEXT_COMPRESSION_COMPONENT_TYPE = 'context-compression';

type ContextCompressionStatus = 'running' | 'success' | 'fail';
type ContextCompressionReason =
  | 'no_messages'
  | 'no_unprotected_history'
  | 'no_token_gain';

export type ContextCompressionComponentData = {
  category: 'Tool';
  type: typeof CONTEXT_COMPRESSION_COMPONENT_TYPE;
  status?: ContextCompressionStatus;
  reason?: ContextCompressionReason;
  title?: LocalizedText;
  message?: LocalizedText;
  summary?: string;
  error?: LocalizedText;
  created_date?: string | Date | null;
  end_date?: string | Date | null;
};

export type ContextCompressionContent =
  TMessageContentComponent<ContextCompressionComponentData>;

export function isContextCompressionComponent(
  content: TMessageContentComponent,
): content is ContextCompressionContent {
  return (
    content.data.category === 'Tool' &&
    content.data.type === CONTEXT_COMPRESSION_COMPONENT_TYPE
  );
}

function isSkipped(reason: unknown) {
  return (
    reason === 'no_messages' ||
    reason === 'no_unprotected_history' ||
    reason === 'no_token_gain'
  );
}

function ContextCompressionLabel({
  data,
}: {
  data: ContextCompressionComponentData;
}) {
  const { t } = useChatkitTranslation();
  const status = data.status ?? 'running';
  const skipped = isSkipped(data.reason);

  if (skipped) {
    return t('message.contextCompression.skipped');
  }

  switch (status) {
    case 'success':
      return t('message.contextCompression.success');
    case 'fail':
      return t('message.contextCompression.fail');
    default:
      return t('message.contextCompression.running');
  }
}

function ContextCompressionIcon({
  data,
}: {
  data: ContextCompressionComponentData;
}) {
  const status = data.status ?? 'running';
  const skipped = isSkipped(data.reason);

  if (status === 'running') {
    return (
      <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" />
    );
  }

  if (status === 'fail') {
    return <XCircle aria-hidden="true" className="h-4 w-4 shrink-0" />;
  }

  return (
    <FileText
      aria-hidden="true"
      className={cn('h-4 w-4 shrink-0', skipped && 'opacity-80')}
    />
  );
}

function getTooltipText(
  data: ContextCompressionComponentData,
  language?: string,
) {
  return resolveLocalizedText(
    data.summary || data.error || data.message,
    language,
  );
}

export function ContextCompressionMessage({
  content,
}: {
  content: ContextCompressionContent;
}) {
  const { i18n } = useChatkitTranslation();
  const data = content.data;
  const status = data.status ?? 'running';
  const tooltipText = getTooltipText(data, i18n.language);
  const label = <ContextCompressionLabel data={data} />;
  const center = (
    <div
      className={cn(
        'inline-flex max-w-[80%] shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        tooltipText && 'cursor-help',
        status === 'fail' && 'text-destructive hover:text-destructive',
      )}
    >
      <ContextCompressionIcon data={data} />
      <span
        className={cn(
          'truncate',
          status === 'running' && 'ck-tool-call-running-text',
        )}
      >
        {label}
      </span>
    </div>
  );

  return (
    <div className="flex w-full items-center justify-center gap-3 py-6">
      <div className="h-px min-w-8 flex-1 bg-border" />
      {tooltipText ? (
        <Tooltip>
          <TooltipTrigger asChild>{center}</TooltipTrigger>
          <TooltipContent
            side="top"
            className="max-h-80 max-w-xl overflow-auto whitespace-pre-wrap text-left text-xs leading-5"
          >
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      ) : (
        center
      )}
      <div className="h-px min-w-8 flex-1 bg-border" />
    </div>
  );
}
