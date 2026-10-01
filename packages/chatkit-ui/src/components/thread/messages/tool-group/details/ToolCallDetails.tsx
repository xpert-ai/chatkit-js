import type { TMessageContentComponent } from '@xpert-ai/chatkit-types';
import { Check, Copy } from 'lucide-react';
import * as React from 'react';
import { resolveLocalizedText } from '../../../../../i18n/localized-text';
import { useChatkitTranslation } from '../../../../../i18n/useChatkitTranslation';
import { parseToolOutputPresentation } from '../../../../../lib/tool-output-attachments';
import { cn } from '../../../../../lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import {
  detectJsonValue,
  getJsonValueSummary,
  JsonTreeView,
  PlainTextBlock,
  RawJsonBlock,
} from '../../../json-tree-view';
import {
  getComponentMessageRenderer,
  hasComponentMessageRendererDetails,
  type ComponentMessageDetailsRenderer,
  type ComponentMessageDetailsRendererProps,
} from '../../component-message-renderers';
import {
  isSandboxShellStep,
  SandboxShellToolCallCard,
} from '../../sandbox-shell-tool-call';
import { ToolOutputAttachments } from '../../tool-output-attachments';
import { getToolStepData, isPausedToolStep } from '../status/step-status';
import type { PartialStepData } from '../types';

const TOOL_CALL_OUTPUT_RENDERERS: Partial<
  Record<string, ComponentMessageDetailsRenderer>
> = {};

function getToolCallOutputRenderer(
  data: PartialStepData,
): ComponentMessageDetailsRenderer {
  const keys = [data.tool, data.type].filter(
    (value): value is string =>
      typeof value === 'string' && Boolean(value.trim()),
  );

  for (const key of keys) {
    const renderer = TOOL_CALL_OUTPUT_RENDERERS[key];
    if (renderer) return renderer;
  }

  return DefaultToolCallOutput;
}

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

function ToolCallValueBlock({
  value,
  destructive = false,
}: {
  value: unknown;
  destructive?: boolean;
}) {
  const { t } = useChatkitTranslation();
  const detected = detectJsonValue(value);

  if (detected.kind === 'text') {
    return (
      <div className="min-w-0 space-y-1">
        <div className="flex justify-end">
          <ToolCallCopyButton value={detected.text} />
        </div>
        <PlainTextBlock value={detected.text} destructive={destructive} />
      </div>
    );
  }

  return (
    <Tabs defaultValue="tree" className="min-w-0">
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

function DefaultToolCallOutput({
  content,
  data,
}: ComponentMessageDetailsRendererProps) {
  const { t } = useChatkitTranslation();
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

  if (output === null && !presentation) return null;

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-medium text-muted-foreground">
        {t('message.toolGroup.outputTitle')}
      </div>
      {presentation ? (
        <ToolOutputAttachments
          presentation={presentation}
          toolCallId={content.id}
          executionId={content.executionId}
        />
      ) : null}
      {output !== null ? <ToolCallValueBlock value={output} /> : null}
    </div>
  );
}

export function ToolCallDetails({
  content,
  isThreadPaused,
}: {
  content: TMessageContentComponent;
  isThreadPaused?: boolean;
}) {
  const { i18n, t } = useChatkitTranslation();
  const data = getToolStepData(content);
  if (isSandboxShellStep(data)) {
    return (
      <div className="ml-2 mt-1">
        <SandboxShellToolCallCard
          data={data}
          isPaused={isPausedToolStep(data, isThreadPaused)}
        />
      </div>
    );
  }

  const renderer = getComponentMessageRenderer(content, data);
  const hasCustomDetails =
    data.error === undefined &&
    hasComponentMessageRendererDetails(renderer, content, data);
  const CustomDetailsRenderer = hasCustomDetails
    ? renderer?.renderDetails
    : undefined;
  if (CustomDetailsRenderer) {
    return (
      <div className="ml-6 mt-1 max-h-60 overflow-auto rounded-md bg-muted/30 text-xs text-muted-foreground">
        <CustomDetailsRenderer content={content} data={data} />
      </div>
    );
  }

  const OutputRenderer = getToolCallOutputRenderer(data);
  const toolName = resolveLocalizedText(data.tool, i18n.language);
  const hasInput = data.input !== undefined && data.input !== null;
  const hasOutput =
    data.error !== undefined ||
    data.output !== undefined ||
    data.artifact !== undefined;

  if (!hasInput && !hasOutput) return null;

  return (
    <div className="ml-6 mt-1 max-h-60 overflow-auto rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      {hasInput && (
        <div className="space-y-1">
          <div className="flex min-w-0 items-baseline gap-1 text-[11px] font-medium text-muted-foreground">
            {toolName ? (
              <>
                <span className="min-w-0 break-all font-mono text-foreground/80">
                  {toolName}
                </span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            <span className="shrink-0">
              {t('message.toolGroup.inputTitle')}
            </span>
          </div>
          <ToolCallValueBlock value={data.input} />
        </div>
      )}
      {hasInput && hasOutput ? <div className="h-2" /> : null}
      {hasOutput ? <OutputRenderer content={content} data={data} /> : null}
    </div>
  );
}
