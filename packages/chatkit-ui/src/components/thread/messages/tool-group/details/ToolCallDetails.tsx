import type { TMessageContentComponent } from '@xpert-ai/chatkit-types';
import { resolveLocalizedText } from '../../../../../i18n/localized-text';
import { useChatkitTranslation } from '../../../../../i18n/useChatkitTranslation';
import {
  getComponentMessageRenderer,
  hasComponentMessageRendererDetails,
  type ComponentMessageDetailsRenderer,
} from '../../component-message-renderers';
import {
  isSandboxShellStep,
  SandboxShellToolCallCard,
} from '../../sandbox-shell-tool-call';
import {
  DefaultToolCallOutput,
  ToolCallValueBlock,
} from '../../tool-call-output';
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
