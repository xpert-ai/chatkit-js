import * as React from 'react';
import {
  PREVIEW_CHANNEL,
  parsePreviewEvent,
  type PreviewElement,
  type ConsoleEntry,
  type PreviewCommand,
} from './protocol';

export function useHtmlPreviewRuntime(
  documentKey: object | null,
  revision: number,
) {
  const session = React.useMemo(
    () => crypto.randomUUID(),
    [documentKey, revision],
  );
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = React.useState(false);
  const [inspecting, setInspecting] = React.useState(false);
  const [selection, setSelection] = React.useState<PreviewElement | null>(null);
  const [logs, setLogs] = React.useState<ConsoleEntry[]>([]);
  const command = React.useCallback(
    (command: PreviewCommand) => {
      frameRef.current?.contentWindow?.postMessage(
        { channel: PREVIEW_CHANNEL, session, command },
        '*',
      );
    },
    [session],
  );
  const inspect = React.useCallback(
    (active: boolean) => {
      setInspecting(active);
      command({ type: 'inspect', active });
    },
    [command],
  );
  React.useLayoutEffect(() => {
    setReady(false);
    setInspecting(false);
    setSelection(null);
    setLogs([]);
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const message = parsePreviewEvent(event.data, session);
      if (!message) return;
      if (message.type === 'ready') setReady(true);
      else if (message.type === 'selected') setSelection(message.element);
      else if (message.type === 'escape') setInspecting(false);
      else if (message.type === 'console')
        setLogs((entries) => [
          ...entries.slice(-199),
          { level: message.level, text: message.text },
        ]);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [session]);
  return {
    session,
    frameRef,
    ready,
    inspecting,
    inspect,
    selection,
    command,
    logs,
    clearLogs: () => setLogs([]),
    clearSelection: () => {
      setSelection(null);
      command({ type: 'clear' });
    },
  };
}
export type HtmlPreviewRuntime = ReturnType<typeof useHtmlPreviewRuntime>;
