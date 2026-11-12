import type { PresentationSource } from './source';
import { useEffect, useRef, useState } from 'react';
import { safeRandomUUID } from '@xpert-ai/chatkit-web-shared';
import type { ArtifactPresentation } from '@xpert-ai/xpert-sdk';
import { useTheme } from '../../providers/Theme';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { createRemoteTheme } from '../remote-view/remote-theme';
import { Button } from '../../components/ui/button';
import {
  isolatePresentationHtml,
  presentationMessage,
} from './presentation-bridge';

export function ArtifactPresentationView({
  source,
  visible = true,
}: {
  source: PresentationSource;
  visible?: boolean;
}) {
  const { t, i18n } = useChatkitTranslation();
  const { theme, isDarkMode, themeRootRef, themeRevision } = useTheme();
  const frame = useRef<HTMLIFrameElement>(null);
  const [entry, setEntry] = useState<{ html: string; title: string } | null>(
    null,
  );
  const [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  const initialize = useRef<() => void>(() => {});
  const appearance = useRef({
    theme,
    isDarkMode,
    locale: i18n.language,
    visible,
  });
  appearance.current = { theme, isDarkMode, locale: i18n.language, visible };
  useEffect(() => {
    initialize.current();
  }, [themeRevision, theme, isDarkMode, i18n.language, visible]);
  useEffect(() => {
    const controller = new AbortController(),
      instanceId = safeRandomUUID();
    let presentation: ArtifactPresentation | null = null,
      ready = false,
      inFlight = 0;
    let refresh: ReturnType<typeof setTimeout>,
      expiry: ReturnType<typeof setTimeout>;
    const current = () => !controller.signal.aborted;
    const fail = () => {
      if (current()) {
        presentation = null;
        setEntry(null);
        setError(true);
        clearTimeout(refresh);
        clearTimeout(expiry);
      }
    };
    const send = (body: object) => {
      if (current())
        frame.current?.contentWindow?.postMessage(
          {
            channel: 'xpertai.remote_component',
            protocolVersion: 1,
            instanceId,
            ...body,
          },
          '*',
        );
    };
    initialize.current = () => {
      const root = themeRootRef.current;
      if (ready && root)
        send({
          type: 'init',
          surface: 'workbench',
          visible: appearance.current.visible,
          locale: appearance.current.locale,
          theme: {
            ...createRemoteTheme(
              root,
              appearance.current.isDarkMode,
              appearance.current.theme.radius,
            ),
            density:
              appearance.current.theme.density === 'compact'
                ? 'compact'
                : 'default',
          },
        });
    };
    async function read(initial = false) {
      const value = await source.read(controller.signal);
      if (!current()) return;
      if (
        !value.readOnly ||
        (presentation &&
          (value.target.versionId !== presentation.target.versionId ||
            value.target.artifactId !== presentation.target.artifactId))
      )
        throw new Error('Reference changed');
      presentation = value;
      if (initial)
        setEntry({
          html: isolatePresentationHtml(value.entry.html),
          title: value.title,
        });
      clearTimeout(expiry);
      clearTimeout(refresh);
      if (value.expiresAt)
        expiry = setTimeout(
          fail,
          Math.min(
            Math.max(0, Date.parse(value.expiresAt) - Date.now()),
            2147483647,
          ),
        );
      refresh = setTimeout(() => void read().catch(fail), 60_000);
      return value;
    }
    const listener = async (event: MessageEvent<unknown>) => {
      if (!presentation || event.source !== frame.current?.contentWindow)
        return;
      const parsed = presentationMessage.safeParse(event.data);
      if (!parsed.success) return;
      const message = parsed.data;
      if (message.type === 'ready') {
        ready = true;
        initialize.current();
        return;
      }
      if (message.instanceId !== instanceId) return;
      if (
        inFlight >= 16 ||
        (message.type === 'executeAction' &&
          !presentation.operations.includes(message.actionKey))
      ) {
        send({
          type: 'error',
          requestId: message.requestId,
          message: t('workbench.presentation.operationDenied'),
        });
        return;
      }
      ++inFlight;
      try {
        if (message.type === 'requestData') {
          const latest = await read();
          if (latest)
            send({
              type: 'data',
              requestId: message.requestId,
              data: latest.data,
            });
        } else {
          const data = await source.query(
            {
              target: presentation.target,
              operation: message.actionKey,
              input: message.input,
            },
            controller.signal,
          );
          send({
            type: 'actionResult',
            requestId: message.requestId,
            result: { success: true, data },
          });
        }
      } catch {
        fail();
      } finally {
        --inFlight;
      }
    };
    setEntry(null);
    setError(false);
    window.addEventListener('message', listener);
    void read(true).catch(fail);
    return () => {
      controller.abort();
      clearTimeout(refresh);
      clearTimeout(expiry);
      window.removeEventListener('message', listener);
      initialize.current = () => {};
    };
  }, [source, retry, t, themeRootRef]);
  if (error)
    return (
      <div
        role="alert"
        className="flex h-full flex-col items-center justify-center gap-4 p-6"
      >
        <p>{t('workbench.presentation.unavailable')}</p>
        <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
          {t('workbench.presentation.retry')}
        </Button>
      </div>
    );
  if (!entry)
    return (
      <div role="status" className="p-6 text-muted-foreground">
        {t('workbench.presentation.loading')}
      </div>
    );
  return (
    <iframe
      ref={frame}
      sandbox="allow-scripts"
      title={entry.title}
      srcDoc={entry.html}
      className="block h-full min-h-0 w-full border-0"
    />
  );
}
