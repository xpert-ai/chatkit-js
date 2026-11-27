import * as React from 'react';
import type {
  ToolDetailPhase,
  ToolDetailReference,
} from '@xpert-ai/chatkit-types';
import type { ToolDetailPage } from '@xpert-ai/xpert-sdk';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Tabs, TabsList, TabsTrigger } from '../../../../ui/tabs';
import StreamContext from '../../../../../providers/Stream';
import { useTheme } from '../../../../../providers/Theme';
import { getSurfaceThemeStyle } from '../../../../../lib/theme-surfaces';
import { useChatkitTranslation } from '../../../../../i18n/useChatkitTranslation';
import { ToolCallValueBlock } from '../../tool-call-output';
import { parseJsonString } from '../../../json-tree-view';

type DetailContent = {
  ref?: ToolDetailReference;
  text?: string;
  format?: 'text' | 'json';
};
export type ToolDetailContents = Partial<
  Record<ToolDetailPhase, DetailContent>
>;

export function ToolDetailDialog({
  open,
  onOpenChange,
  title,
  tool,
  contents,
  initialPhase,
  onReturnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  tool?: string;
  contents: ToolDetailContents;
  initialPhase: ToolDetailPhase;
  onReturnFocus: () => void;
}) {
  const { t } = useChatkitTranslation();
  const stream = React.useContext(StreamContext);
  const theme = useTheme({ optional: true });
  const [phase, setPhase] = React.useState(initialPhase);
  const [offsets, setOffsets] = React.useState([0]);
  const offset = offsets[offsets.length - 1];
  const copyController = React.useRef<AbortController | null>(null);
  const panelId = React.useId();
  const [page, setPage] = React.useState<ToolDetailPage>();
  const [error, setError] = React.useState(false);
  const [attempt, retry] = React.useReducer((value: number) => value + 1, 0);
  const [copyState, setCopyState] = React.useState<
    'idle' | 'copying' | 'copied' | 'error'
  >('idle');
  const [wide, setWide] = React.useState(false);
  const selected = contents[phase];
  const refKey = JSON.stringify(selected?.ref);
  React.useEffect(() => {
    if (open) {
      setPhase(initialPhase);
      setOffsets([0]);
      setCopyState('idle');
    }
  }, [open, initialPhase]);
  React.useEffect(() => {
    copyController.current?.abort();
    setCopyState('idle');
    return () => {
      copyController.current?.abort();
    };
  }, [open, phase, refKey]);
  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setPage(undefined);
    setError(false);
    const ref = selected?.ref;
    if (ref) {
      if (!stream?.client.conversations.getToolDetail) {
        setError(true);
        return;
      }
      void stream.client.conversations
        .getToolDetail(ref, { offset, signal: controller.signal })
        .then(
          (result) => {
            if (!controller.signal.aborted) setPage(result);
          },
          () => {
            if (!controller.signal.aborted) setError(true);
          },
        );
    } else if (selected?.text !== undefined) {
      const text = selected.text;
      let end = Math.min(offset + 16_384, text.length);
      if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end--;
      setPage({
        content: text.slice(offset, end),
        format: selected.format ?? 'text',
        offset,
        nextOffset: end < text.length ? end : null,
        totalCharacters: text.length,
        byteLength: new TextEncoder().encode(text).length,
      });
    } else setError(true);
    return () => controller.abort();
  }, [
    open,
    refKey,
    selected?.text,
    selected?.format,
    offset,
    attempt,
    stream?.client,
  ]);

  async function fullText(signal: AbortSignal) {
    if (!selected?.ref) {
      if (selected?.text === undefined) throw new Error('Unavailable');
      return selected.text;
    }
    if (!stream) throw new Error('Unavailable');
    const chunks: string[] = [];
    let cursor: number | null = 0;
    while (cursor !== null) {
      const result: ToolDetailPage =
        await stream.client.conversations.getToolDetail(selected.ref, {
          offset: cursor,
          signal,
        });
      signal.throwIfAborted();
      chunks.push(result.content);
      cursor = result.nextOffset;
    }
    return chunks.join('');
  }
  function copyFull() {
    copyController.current?.abort();
    const controller = new AbortController();
    copyController.current = controller;
    setCopyState('copying');
    // Promise-backed ClipboardItem keeps the first-click activation across the lazy read.
    const operation =
      typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write
        ? navigator.clipboard.write([
            new ClipboardItem({
              'text/plain': fullText(controller.signal).then(
                (text) => new Blob([text], { type: 'text/plain' }),
              ),
            }),
          ])
        : fullText(controller.signal).then((text) =>
            navigator.clipboard.writeText(text),
          );
    void operation.then(
      () => {
        if (!controller.signal.aborted) setCopyState('copied');
      },
      () => {
        if (!controller.signal.aborted) setCopyState('error');
      },
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        layout="sectioned"
        className="resize min-w-0"
        style={{
          ...(theme ? getSurfaceThemeStyle(theme.theme) : {}),
          width: wide ? 'min(90rem, 94vw)' : 'min(56rem, 92vw)',
          height: 'min(40rem, 85dvh)',
        }}
        closeLabel={t('message.toolGroup.details.close')}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {t('message.toolGroup.details.snapshot')}
          </DialogDescription>
          <Tabs
            value={phase}
            onValueChange={(value) => {
              if (
                value === 'input' ||
                value === 'output' ||
                value === 'error'
              ) {
                setPhase(value);
                setOffsets([0]);
                setCopyState('idle');
              }
            }}
          >
            <TabsList aria-label={t('message.toolGroup.detailsTitle')}>
              {(['input', 'output', 'error'] as const)
                .filter((value) => contents[value])
                .map((value) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    aria-controls={panelId}
                    id={`${panelId}-${value}`}
                  >
                    {t(`message.toolGroup.${value}Title`)}
                  </TabsTrigger>
                ))}
            </TabsList>
          </Tabs>
        </DialogHeader>
        <DialogBody
          role="tabpanel"
          id={panelId}
          aria-labelledby={`${panelId}-${phase}`}
          tabIndex={0}
          className="min-h-0 min-w-0 flex-1 overflow-auto"
        >
          {error ? (
            <div role="alert" className="space-y-2">
              <p>{t('message.toolGroup.details.unavailable')}</p>
              <Button variant="outline" onClick={retry}>
                {t('message.toolGroup.details.retry')}
              </Button>
            </div>
          ) : !page ? (
            <p role="status">{t('message.toolGroup.details.loading')}</p>
          ) : page.offset === 0 &&
            page.nextOffset === null &&
            (page.format === 'json' ||
              parseJsonString(page.content) !== null) ? (
            <ToolCallValueBlock
              value={page.content}
              copyLabel={t('message.toolGroup.details.copyFull')}
            />
          ) : (
            <pre className="whitespace-pre-wrap wrap-anywhere font-mono text-xs leading-relaxed">
              {page.content || t('message.toolGroup.emptyValue')}
            </pre>
          )}
          {tool && (
            <details className="mt-4 text-xs text-muted-foreground">
              <summary>{t('message.toolGroup.details.callInfo')}</summary>
              <code className="wrap-anywhere">{tool}</code>
            </details>
          )}
        </DialogBody>
        <DialogFooter className="flex-wrap">
          {page && (
            <span className="mr-auto text-xs text-muted-foreground">
              {t('message.toolGroup.details.range', {
                start: page.offset,
                end: page.offset + page.content.length,
                total: page.totalCharacters,
              })}
            </span>
          )}
          <Button variant="ghost" onClick={() => setWide(!wide)}>
            {t(
              wide
                ? 'message.toolGroup.details.restoreSize'
                : 'message.toolGroup.details.expandSize',
            )}
          </Button>
          <Button
            variant="outline"
            disabled={!page || offset === 0}
            onClick={() => setOffsets((values) => values.slice(0, -1))}
          >
            {t('message.toolGroup.details.previous')}
          </Button>
          <Button
            variant="outline"
            disabled={!page || page.nextOffset === null}
            onClick={() => {
              if (page?.nextOffset != null)
                setOffsets((values) => [...values, page.nextOffset!]);
            }}
          >
            {t('message.toolGroup.details.next')}
          </Button>
          <Button
            disabled={error || !page || copyState === 'copying'}
            onClick={copyFull}
          >
            {t(
              `message.toolGroup.details.${copyState === 'idle' ? 'copyFull' : copyState}`,
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
