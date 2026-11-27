import * as React from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogTrigger,
} from '../../ui/dialog';
import { useTheme } from '../../../providers/Theme';
import { getSurfaceThemeStyle } from '../../../lib/theme-surfaces';
import type {
  ToolOutputAttachmentPreviewRequest,
  ToolOutputImageAttachment,
  ToolOutputPresentation,
} from '@xpert-ai/chatkit-types';
import { ImageIcon, Loader2, RefreshCw } from 'lucide-react';
import { isEqual } from 'lodash-es';

import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import {
  parseToolOutputAttachmentPreview,
  toolOutputAttachmentKey,
} from '../../../lib/tool-output-attachments';
import { ParentMessengerContext } from '../../../providers/ParentMessenger';
import { Button } from '../../ui/button';

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
  const theme = useTheme({ optional: true });
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
  const description = [sourceLabel, dimensions].filter(Boolean).join(' · ');
  const previewStyle: React.CSSProperties = {
    aspectRatio:
      attachment.width && attachment.height
        ? `${attachment.width} / ${attachment.height}`
        : '16 / 9',
  };

  if (state.status === 'loading') {
    return (
      <div
        className="flex max-h-64 w-full max-w-96 min-w-0 items-center justify-center rounded-chat-panel border border-border bg-background"
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
        className="flex max-h-64 w-full max-w-96 min-w-0 flex-col items-center justify-center gap-2 rounded-chat-panel border border-dashed border-border bg-background px-3 text-center"
        style={previewStyle}
      >
        <ImageIcon
          className="h-5 w-5 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="line-clamp-2 text-[11px] text-muted-foreground">
          {t('message.toolGroup.attachments.unavailable')}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="pointer-coarse:min-h-11"
          onClick={retry}
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          {t('message.toolGroup.attachments.retry')}
        </Button>
      </div>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group w-full max-w-96 min-w-0 overflow-hidden rounded-chat-panel border border-border bg-background text-left shadow-sm transition-colors hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
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
          <span className="block border-t border-border px-3 py-[calc(0.375rem*var(--chat-density-scale,1))] text-xs font-medium leading-4 text-foreground">
            <span className="line-clamp-1">{title}</span>
          </span>
        </button>
      </DialogTrigger>
      <DialogContent
        layout="sectioned"
        className="max-h-[92dvh] min-w-0"
        style={{
          ...(theme ? getSurfaceThemeStyle(theme.theme) : {}),
          width: 'min(92vw, 75rem)',
        }}
        closeLabel={t('message.toolGroup.attachments.close')}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="min-h-0 overflow-auto bg-muted/30">
          <img
            className="mx-auto h-auto max-h-[75dvh] max-w-full object-contain"
            src={state.previewUrl}
            alt={attachment.alt ?? title}
            referrerPolicy="no-referrer"
            onError={fail}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
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
