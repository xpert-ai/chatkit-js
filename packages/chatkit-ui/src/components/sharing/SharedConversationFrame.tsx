import { useEffect, useRef, useState } from 'react';
import { ThemeProvider } from '../../providers/Theme';
import { setLanguage } from '../../i18n';
import { ReadonlyMessageList } from './ReadonlyMessageList';
import {
  readSharedFrameEvent,
  type SharedFrameData,
} from './shared-frame-protocol';

/** Passive iframe: no StreamProvider, SDK client, credentials or host command bridge. */
export function SharedConversationFrame() {
  const [data, setData] = useState<SharedFrameData | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const params = new URLSearchParams(window.location.hash.slice(1));
  const origin = params.get('parentOrigin') ?? '';
  const channelId = params.get('channelId') ?? '';

  useEffect(() => {
    if (window.parent === window || !/^https?:\/\//.test(origin)) return;
    const receive = (event: MessageEvent) => {
      const next = readSharedFrameEvent(
        event,
        window.parent,
        origin,
        channelId,
      );
      if (!next) return;
      setLanguage(next.locale);
      setData(next);
    };
    window.addEventListener('message', receive);
    window.parent.postMessage(
      { type: 'chatkit:shared-transcript-ready', channelId },
      origin,
    );
    return () => window.removeEventListener('message', receive);
  }, [origin, channelId]);

  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(
      () => setData(null),
      Math.min(
        Math.max(0, Date.parse(data.snapshot.expiresAt) - Date.now()),
        2147483647,
      ),
    );
    return () => clearTimeout(timer);
  }, [data]);

  useEffect(() => {
    if (!content.current || !data) return;
    const report = () =>
      window.parent.postMessage(
        {
          type: 'chatkit:shared-transcript-size',
          channelId,
          height: Math.ceil(
            content.current?.getBoundingClientRect().height ?? 0,
          ),
        },
        origin,
      );
    const observer = new ResizeObserver(report);
    observer.observe(content.current);
    report();
    return () => observer.disconnect();
  }, [data, origin, channelId]);

  return data ? (
    <ThemeProvider theme={data.theme}>
      <div
        ref={content}
        className="bg-background text-foreground p-[var(--density-padding,1rem)]"
      >
        <ReadonlyMessageList messages={data.snapshot.messages} />
      </div>
    </ThemeProvider>
  ) : null;
}
