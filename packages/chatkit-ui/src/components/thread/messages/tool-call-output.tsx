import * as React from 'react';
import { Check, Copy } from 'lucide-react';

import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { parseToolOutputPresentation } from '../../../lib/tool-output-attachments';
import { cn } from '../../../lib/utils';
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
}: {
  value: string;
  className?: string;
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
    : t('message.toolGroup.copy');

  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        className,
      )}
      aria-label={label}
      title={label}
      onClick={handleCopy}
    >
      {isCopied ? (
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </button>
  );
}

export function ToolCallValueBlock({
  value,
  destructive = false,
}: {
  value: unknown;
  destructive?: boolean;
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

  if (detected.kind === 'text') {
    return (
      <div className="min-w-0 space-y-1">
        {imageSummary}
        <div className="flex justify-end">
          <ToolCallCopyButton value={detected.text} />
        </div>
        <PlainTextBlock value={detected.text} destructive={destructive} />
      </div>
    );
  }

  return (
    <Tabs defaultValue="tree" className="min-w-0">
      {imageSummary}
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] text-muted-foreground">
          {t('message.toolGroup.jsonTitle')} ·{' '}
          {getJsonValueSummary(detected.value)}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <ToolCallCopyButton value={detected.raw} />
          <TabsList className="rounded-md p-0.5">
            <TabsTrigger className="px-2 py-0.5 text-[11px]" value="tree">
              {t('message.toolGroup.jsonTree')}
            </TabsTrigger>
            <TabsTrigger className="px-2 py-0.5 text-[11px]" value="raw">
              {t('message.toolGroup.jsonRaw')}
            </TabsTrigger>
          </TabsList>
        </div>
      </div>
      <TabsContent value="tree" className="mt-0">
        <JsonTreeView value={detected.value} />
      </TabsContent>
      <TabsContent value="raw" className="mt-0">
        <RawJsonBlock raw={detected.raw} />
      </TabsContent>
    </Tabs>
  );
}

export function DefaultToolCallOutput({
  data,
}: ComponentMessageDetailsRendererProps) {
  const { t } = useChatkitTranslation();
  // Image artifacts are retained for model input, but do not opt into UI display.
  const presentation = parseToolOutputPresentation(data.artifact);
  const output = data.output ?? (presentation ? null : data.artifact) ?? null;
  const error = data.error ?? null;

  if (error) {
    return (
      <div className="space-y-1">
        <div className="text-[11px] font-medium text-destructive">
          {t('message.toolGroup.errorTitle')}
        </div>
        <ToolCallValueBlock value={error} destructive />
      </div>
    );
  }

  if (output === null) return null;

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-medium text-muted-foreground">
        {t('message.toolGroup.outputTitle')}
      </div>
      <ToolCallValueBlock value={output} />
    </div>
  );
}
