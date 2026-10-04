import * as React from 'react';

import * as Dialog from '@radix-ui/react-dialog';
import type {
  ToolOutputAttachmentPreviewRequest,
  ToolOutputImageAttachment,
  ToolOutputPresentation,
} from '@xpert-ai/chatkit-types';
import { ImageIcon, Loader2, RefreshCw, X } from 'lucide-react';
import { isEqual } from 'lodash-es';

import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import {
  parseToolOutputAttachmentPreview,
  toolOutputAttachmentKey,
} from '../../../lib/tool-output-attachments';
import { cn } from '../../../lib/utils';
import { ParentMessengerContext } from '../../../providers/ParentMessenger';

type PreviewState =
  | { status: 'loading' }
  | { status: 'success'; previewUrl: string }
  | { status: 'error' };

function useToolOutputAttachmentPreview(
  request: ToolOutputAttachmentPreviewRequest,
) {
  const parentMessenger = React.useContext(ParentMessengerContext);
  const sendCommand = parentMessenger?.sendCommand;
  const isParentAvailable = parentMessenger?.isParentAvailable;
  // Streaming reparses the same descriptor. Only changed request values should
  // resolve a new preview; keep the full descriptor and execution scope intact.
  const requestRef = React.useRef(request);
  if (!isEqual(requestRef.current, request)) requestRef.current = request;
  const stableRequest = requestRef.current;
  const [attempt, setAttempt] = React.useState(0);
  const [state, setState] = React.useState<PreviewState>({
    status: 'loading',
  });
  React.useEffect(() => {
    if (!isParentAvailable || !sendCommand) {
      setState({ status: 'error' });
      return;
    }

    let cancelled = false;
    let refreshTimer: number | null = null;
    setState({ status: 'loading' });

    void sendCommand('onToolOutputAttachmentPreview', stableRequest)
      .then((response) => {
        if (cancelled) return;
        const preview = parseToolOutputAttachmentPreview(response);
        if (!preview) {
          setState({ status: 'error' });
          return;
        }

        if (preview.expiresAt) {
          const remainingLifetime = Date.parse(preview.expiresAt) - Date.now();
          if (remainingLifetime <= 0) {
            setState({ status: 'error' });
            return;
          }
          refreshTimer = window.setTimeout(
            () => setAttempt((current) => current + 1),
            Math.max(1_000, Math.floor(remainingLifetime * 0.8)),
          );
        }

        setState({ status: 'success', previewUrl: preview.previewUrl });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });

    return () => {
      cancelled = true;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    };
  }, [attempt, isParentAvailable, sendCommand, stableRequest]);

  return {
    state,
    fail: () => setState({ status: 'error' }),
    retry: () => setAttempt((current) => current + 1),
  };
}

function attachmentTitle(
  attachment: ToolOutputImageAttachment,
  fallback: string,
) {
  return (
    attachment.title ??
    attachment.alt ??
    (attachment.anchors?.page
      ? `${fallback} · ${attachment.anchors.page}`
      : fallback)
  );
}

function ToolOutputImageAttachmentCard({
  attachment,
  index,
  toolCallId,
  executionId,
}: {
  attachment: ToolOutputImageAttachment;
  index: number;
  toolCallId?: string;
  executionId?: string;
}) {
  const { t } = useChatkitTranslation();
  const { state, fail, retry } = useToolOutputAttachmentPreview({
    attachment,
    toolCallId,
    executionId,
  });
  const fallbackTitle = t('message.toolGroup.attachments.imageTitle', {
    index: index + 1,
  });
  const title = attachmentTitle(attachment, fallbackTitle);
  const dimensions =
    attachment.width && attachment.height
      ? `${attachment.width} × ${attachment.height}`
      : null;
  const sourceLabel = t(
    `message.toolGroup.attachments.sources.${attachment.source}`,
  );
  const description = [
    sourceLabel,
    dimensions,
    t('message.toolGroup.attachments.modelDetail', {
      detail: attachment.modelDetail,
    }),
  ]
    .filter(Boolean)
    .join(' · ');
  const previewStyle: React.CSSProperties = {
    aspectRatio:
      attachment.width && attachment.height
        ? `${attachment.width} / ${attachment.height}`
        : '16 / 9',
  };

  if (state.status === 'loading') {
    return (
      <div
        className="flex max-h-64 w-full max-w-96 min-w-0 items-center justify-center rounded-lg border border-border bg-background"
        style={previewStyle}
        aria-label={t('message.toolGroup.attachments.loading', { title })}
      >
        <Loader2
          className="h-5 w-5 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div
        className="flex max-h-64 w-full max-w-96 min-w-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 text-center"
        style={previewStyle}
      >
        <ImageIcon
          className="h-5 w-5 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="line-clamp-2 text-[11px] text-muted-foreground">
          {t('message.toolGroup.attachments.unavailable')}
        </span>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          onClick={retry}
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          {t('message.toolGroup.attachments.retry')}
        </button>
      </div>
    );
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="group w-full max-w-96 min-w-0 overflow-hidden rounded-lg border border-border bg-background text-left shadow-sm transition-colors hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          aria-label={t('message.toolGroup.attachments.open', { title })}
        >
          <span
            className="block max-h-64 w-full overflow-hidden bg-muted/30"
            style={previewStyle}
          >
            <img
              className="h-full w-full object-contain"
              src={state.previewUrl}
              alt={attachment.alt ?? title}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={fail}
            />
          </span>
          <span className="block border-t border-border px-3 py-2 text-xs font-medium leading-4 text-foreground">
            <span className="line-clamp-1">{title}</span>
            <span className="block truncate text-muted-foreground">
              {description}
            </span>
          </span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/80 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-[81] flex max-h-[92vh] w-[min(92vw,1200px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl',
            'focus:outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-sm font-semibold text-foreground">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              aria-label={t('message.toolGroup.attachments.close')}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-black/95 p-4">
            <img
              className="mx-auto h-auto max-h-[calc(92vh-6rem)] max-w-full object-contain"
              src={state.previewUrl}
              alt={attachment.alt ?? title}
              referrerPolicy="no-referrer"
              onError={fail}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ToolOutputAttachments({
  presentation,
  toolCallId,
  executionId,
}: {
  presentation: ToolOutputPresentation;
  toolCallId?: string;
  executionId?: string;
}) {
  return (
    <div
      className="flex w-full min-w-0 flex-wrap items-start gap-3"
      data-testid="tool-output-attachments"
    >
      {presentation.attachments.map((attachment, index) => (
        <ToolOutputImageAttachmentCard
          key={toolOutputAttachmentKey(attachment)}
          attachment={attachment}
          index={index}
          toolCallId={toolCallId}
          executionId={executionId}
        />
      ))}
    </div>
  );
}
