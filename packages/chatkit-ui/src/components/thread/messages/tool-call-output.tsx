import * as React from 'react';
import { Check, Copy } from 'lucide-react';

import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { parseToolOutputPresentation } from '../../../lib/tool-output-attachments';
import { cn } from '../../../lib/utils';
import { messageActionButtonClassName } from '../message-action-styles';
import {
  getJsonValueSummary,
  JsonTreeView,
  PlainTextBlock,
  RawJsonBlock,
} from '../json-tree-view';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import type { ComponentMessageDetailsRendererProps } from './component-message-renderers';
import { prepareToolOutputDisplay } from './tool-output-display';

function ToolCallCopyButton({
  value,
  className,
  label: copyLabel,
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const { t } = useChatkitTranslation();
  const [isCopied, setIsCopied] = React.useState(false);
  const resetTimeoutRef = React.useRef<number | null>(null);

  const clearResetTimeout = React.useCallback(() => {
    if (resetTimeoutRef.current === null) return;
    window.clearTimeout(resetTimeoutRef.current);
    resetTimeoutRef.current = null;
  }, []);

  React.useEffect(() => clearResetTimeout, [clearResetTimeout]);

  const handleCopy = React.useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;

    void navigator.clipboard
      .writeText(value)
      .then(() => {
        setIsCopied(true);
        clearResetTimeout();
        resetTimeoutRef.current = window.setTimeout(() => {
          setIsCopied(false);
          resetTimeoutRef.current = null;
        }, 1500);
      })
      .catch(() => undefined);
  }, [clearResetTimeout, value]);

  const label = isCopied
    ? t('message.toolGroup.copied')
    : (copyLabel ?? t('message.toolGroup.copy'));

  return (
    <button
      type="button"
      className={cn(
        messageActionButtonClassName,
        'hover:bg-background',
        className,
      )}
      aria-label={label}
      title={label}
      onClick={handleCopy}
    >
      {isCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
    </button>
  );
}

export function ToolCallValueBlock({
  value,
  destructive = false,
  copyLabel,
  header,
  description,
  bounded = false,
}: {
  value: unknown;
  destructive?: boolean;
  copyLabel?: string;
  header?: React.ReactNode;
  description?: React.ReactNode;
  bounded?: boolean;
}) {
  const { t } = useChatkitTranslation();
  const { display: detected, omittedImageCount } = React.useMemo(
    () =>
      prepareToolOutputDisplay(value, (mimeType) =>
        t('message.toolGroup.attachments.embeddedImagePlaceholder', {
          mimeType,
        }),
      ),
    [t, value],
  );
  const imageSummary = omittedImageCount ? (
    <p className="text-[11px] text-muted-foreground">
      {t('message.toolGroup.attachments.embeddedImagesOmitted', {
        count: omittedImageCount,
      })}
    </p>
  ) : null;
  const toolbarClassName =
    'flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1';
  const previewClassName = bounded
    ? 'max-h-[6lh] overflow-auto [overflow-wrap:anywhere]'
    : undefined;

  if (detected.kind === 'text') {
    if (!detected.text.trim())
      return (
        <div className="space-y-1">
          {header}
          {description}
          <p className="text-muted-foreground">
            {t('message.toolGroup.emptyValue')}
          </p>
        </div>
      );
    return (
      <div className="min-w-0 space-y-1">
        {imageSummary}
        <div className={toolbarClassName}>
          {header ?? <span />}
          <ToolCallCopyButton value={detected.text} label={copyLabel} />
        </div>
        {description}
        <div className={previewClassName}>
          <PlainTextBlock value={detected.text} destructive={destructive} />
        </div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="tree" className="min-w-0">
      {imageSummary}
      <div className={cn(toolbarClassName, 'mb-1')}>
        {header ?? (
          <span className="min-w-0 truncate text-[11px] text-muted-foreground">
            {t('message.toolGroup.jsonTitle')} ·{' '}
            {getJsonValueSummary(detected.value)}
          </span>
        )}
        <div className="flex shrink-0 items-center gap-1">
          <ToolCallCopyButton value={detected.raw} label={copyLabel} />
          <TabsList className="rounded-chat-item p-0.5">
            <TabsTrigger className="px-2 py-0.5 text-[11px]" value="tree">
              {t('message.toolGroup.jsonTree')}
            </TabsTrigger>
            <TabsTrigger className="px-2 py-0.5 text-[11px]" value="raw">
              {t('message.toolGroup.jsonRaw')}
            </TabsTrigger>
          </TabsList>
        </div>
      </div>
      {description}
      <TabsContent
        value="tree"
        className={cn(
          'mt-0',
          bounded && 'max-h-[12lh] overflow-auto [overflow-wrap:anywhere]',
        )}
      >
        <JsonTreeView value={detected.value} />
      </TabsContent>
      <TabsContent value="raw" className={cn('mt-0', previewClassName)}>
        <RawJsonBlock raw={detected.raw} />
      </TabsContent>
    </Tabs>
  );
}

export function getDefaultToolCallOutput(
  data: ComponentMessageDetailsRendererProps['data'],
) {
  // Image artifacts are retained for model input, but do not opt into UI display.
  const isPreview = data.toolPresentation === 'redacted';
  const attachmentOutput =
    isPreview || parseToolOutputPresentation(data.artifact)
      ? undefined
      : data.artifact;
  return isPreview || data.output !== undefined
    ? data.output
    : attachmentOutput;
}

export function DefaultToolCallOutput({
  data,
}: ComponentMessageDetailsRendererProps) {
  const { t } = useChatkitTranslation();
  const isPreview = data.toolPresentation === 'redacted';
  const output = getDefaultToolCallOutput(data);
  const error = data.error ?? null;

  const errorDetails = error ? (
    <div className="space-y-1">
      <div className="text-[11px] font-medium text-destructive">
        {t('message.toolGroup.errorTitle')}
      </div>
      <ToolCallValueBlock value={error} destructive />
    </div>
  ) : null;

  if (errorDetails && !isPreview) return errorDetails;
  if (output === undefined || (output === null && !isPreview))
    return errorDetails;

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-medium text-muted-foreground">
        {t('message.toolGroup.outputTitle')}
      </div>
      <ToolCallValueBlock value={output} />
      {errorDetails}
    </div>
  );
}
