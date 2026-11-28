import * as React from 'react';
import {
  previewToolValue,
  type TMessageContentComponent,
  type ToolDetailPhase,
  type ToolValuePresentation,
} from '@xpert-ai/chatkit-types';
import { useChatkitTranslation } from '../../../../../i18n/useChatkitTranslation';
import { resolveLocalizedText } from '../../../../../i18n/localized-text';
import {
  getDefaultToolCallOutput,
  ToolCallValueBlock,
} from '../../tool-call-output';
import { prepareToolOutputDisplay } from '../../tool-output-display';
import { getToolStepData } from '../status/step-status';
import { getToolActivityLabel } from '../grouping/categories';
import type { StepStatus } from '../types';
import { ToolDetailDialog, type ToolDetailContents } from './ToolDetailDialog';
import {
  getComponentMessageRenderer,
  hasComponentMessageRendererDetails,
} from '../../component-message-renderers';
import { Button } from '../../../../ui/button';

export function ToolCallDetails({
  content,
  isThreadPaused,
  status,
}: {
  content: TMessageContentComponent;
  isThreadPaused?: boolean;
  status?: StepStatus;
}) {
  const { t, i18n } = useChatkitTranslation();
  const data = getToolStepData(content);
  const renderer = getComponentMessageRenderer(content, data);
  const customValue = renderer ? data.data : undefined;
  // Preserve existing result cards only when their complete payload fits the preview budget.
  const customText =
    customValue === undefined ? '' : JSON.stringify(customValue);
  const CustomDetails =
    !data.presentation &&
    !data.error &&
    new TextEncoder().encode(customText).length <= 2048 &&
    (!Array.isArray(customValue) || customValue.length <= 5) &&
    hasComponentMessageRendererDetails(renderer, content, data)
      ? renderer?.renderDetails
      : undefined;
  const [openPhase, setOpenPhase] = React.useState<ToolDetailPhase>();
  const detailTrigger = React.useRef<HTMLButtonElement | null>(null);
  const phases = React.useMemo(() => {
    const output = getDefaultToolCallOutput(data);
    const values = {
      input: data.input,
      output: output === undefined ? customValue : output,
      error: data.error,
    };
    return (['input', 'output', 'error'] as const).flatMap((phase) => {
      const raw = values[phase];
      const declared = data.presentation?.[phase];
      if (
        phase === 'error' &&
        raw === undefined &&
        (!declared || declared.state === 'unavailable')
      )
        return [];
      const prepared =
        raw === undefined
          ? undefined
          : prepareToolOutputDisplay(raw, (mimeType) =>
              t('message.toolGroup.attachments.embeddedImagePlaceholder', {
                mimeType,
              }),
            );
      const normalized = prepared?.display;
      const safeValue =
        normalized?.kind === 'text' ? normalized.text : normalized?.value;
      const legacy =
        safeValue === undefined ? undefined : previewToolValue(safeValue);
      const view: ToolValuePresentation | undefined =
        declared ?? legacy?.presentation;
      return [
        {
          phase,
          view,
          omittedImageCount: prepared?.omittedImageCount,
          preview: legacy?.preview,
          detail:
            view?.state !== 'available'
              ? undefined
              : declared?.detail
                ? { ref: declared.detail }
                : !declared?.truncated && legacy
                  ? { text: legacy.text, format: legacy.presentation.format }
                  : undefined,
        },
      ];
    });
  }, [
    data.input,
    data.output,
    data.artifact,
    data.error,
    data.presentation,
    customValue,
    t,
  ]);
  const contents: ToolDetailContents = Object.fromEntries(
    phases
      .filter((item) => item.detail)
      .map((item) => [item.phase, item.detail]),
  );
  const title = getToolActivityLabel(content, i18n.language, status);

  return (
    <div className="ml-5 mt-2 min-w-0 space-y-3 rounded-chat-panel border border-border/70 bg-muted/30 px-5 py-2.5 text-xs text-foreground in-data-[density=compact]:space-y-2 in-data-[density=compact]:px-4 in-data-[density=compact]:py-2 in-data-[density=spacious]:space-y-4 in-data-[density=spacious]:px-6 in-data-[density=spacious]:py-3">
      {phases.map(({ phase, view, preview, detail, omittedImageCount }) => {
        if (phase === 'output' && CustomDetails)
          return (
            <div key={phase} className="max-h-[12lh] overflow-auto">
              <CustomDetails content={content} data={data} />
            </div>
          );
        const summary = resolveLocalizedText(view?.summary, i18n.language);
        const header = (
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="font-medium">
              {t(`message.toolGroup.${phase}Title`)}
            </span>
            {view?.state === 'available' && (
              <span>
                {view.format === 'json'
                  ? t('message.toolGroup.jsonTitle')
                  : t('message.toolGroup.details.text')}
                {view.itemCount !== undefined &&
                  ` · ${t('message.toolGroup.details.items', { count: view.itemCount })}`}
                {view.lineCount !== undefined &&
                  ` · ${t('message.toolGroup.details.lines', { count: view.lineCount })}`}
                {view.byteLength !== undefined &&
                  ` · ${t('message.toolGroup.details.bytes', { count: view.byteLength })}`}
              </span>
            )}
          </div>
        );
        const description = (
          <>
            {Boolean(omittedImageCount) && (
              <p className="text-muted-foreground">
                {t('message.toolGroup.attachments.embeddedImagesOmitted', {
                  count: omittedImageCount,
                })}
              </p>
            )}
            {summary && <p className="wrap-anywhere">{summary}</p>}
          </>
        );
        const absent =
          view?.state === 'not-public'
            ? 'details.notPublic'
            : phase === 'output' && status === 'running'
              ? isThreadPaused
                ? 'outputPaused'
                : 'outputPending'
              : phase === 'input'
                ? 'inputUnavailable'
                : 'outputUnavailable';
        return (
          <section
            key={phase}
            className="min-w-0 space-y-1"
            aria-label={t(`message.toolGroup.${phase}Title`)}
          >
            {view?.state === 'available' ? (
              <>
                {view.mode !== 'summary' && preview !== undefined ? (
                  <ToolCallValueBlock
                    value={preview}
                    destructive={phase === 'error'}
                    copyLabel={t('message.toolGroup.details.copyPreview')}
                    header={header}
                    description={description}
                    bounded
                  />
                ) : (
                  <>
                    {header}
                    {description}
                  </>
                )}
                {view.truncated && (
                  <p className="text-muted-foreground">
                    {t(
                      view.mode === 'summary'
                        ? 'message.toolGroup.details.summaryOnly'
                        : 'message.toolGroup.details.truncated',
                    )}
                  </p>
                )}
                {detail ? (
                  <Button
                    variant="link"
                    className="h-auto px-0 text-xs"
                    onClick={(event) => {
                      detailTrigger.current = event.currentTarget;
                      setOpenPhase(phase);
                    }}
                  >
                    {t('message.toolGroup.details.open')}
                  </Button>
                ) : (
                  view.truncated && (
                    <p className="text-muted-foreground">
                      {t(
                        status === 'running'
                          ? 'message.toolGroup.details.pending'
                          : 'message.toolGroup.details.unavailable',
                      )}
                    </p>
                  )
                )}
              </>
            ) : (
              <>
                {header}
                <p className="text-muted-foreground">
                  {t(`message.toolGroup.${absent}`)}
                </p>
              </>
            )}
          </section>
        );
      })}
      <ToolDetailDialog
        open={Boolean(openPhase)}
        onOpenChange={(open) => {
          if (!open) setOpenPhase(undefined);
        }}
        title={title}
        tool={data.tool}
        contents={contents}
        initialPhase={openPhase ?? 'output'}
        onReturnFocus={() => detailTrigger.current?.focus()}
      />
    </div>
  );
}
