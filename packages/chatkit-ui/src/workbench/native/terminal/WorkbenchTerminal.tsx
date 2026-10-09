import * as React from 'react';
import type { Client, TerminalConnection } from '@xpert-ai/xpert-sdk';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Button } from '../../../components/ui/button';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { useTheme } from '../../../providers/Theme';
import {
  terminalRestriction,
  type TerminalRestriction,
} from './terminal-restriction';

export default function WorkbenchTerminal({
  client,
  conversationId,
  projectId,
  active,
  onUnavailable,
}: {
  client: Client;
  conversationId?: string | null;
  projectId?: string | null;
  active: boolean;
  onUnavailable?: (reason: TerminalRestriction) => void;
}) {
  const { t } = useChatkitTranslation();
  const { themeRevision } = useTheme();
  const callbacks = React.useRef({ t, active });
  callbacks.current = { t, active };
  const container = React.useRef<HTMLDivElement>(null);
  const terminalRef = React.useRef<Terminal | null>(null);
  const fitRef = React.useRef<FitAddon | null>(null);
  const connectionRef = React.useRef<TerminalConnection | null>(null);
  const [attempt, reconnect] = React.useReducer((x) => x + 1, 0);
  const [status, setStatus] = React.useState<
    'terminalConnecting' | 'terminalReady' | 'terminalEnded'
  >('terminalConnecting');
  const [error, setError] = React.useState('');
  const [directory, setDirectory] = React.useState('');
  React.useEffect(() => {
    if (!conversationId || !container.current) return;
    const abort = new AbortController();
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      scrollback: 5000,
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(container.current);
    terminalRef.current = terminal;
    fitRef.current = fit;
    const resize = () => {
      if (
        !abort.signal.aborted &&
        container.current?.isConnected &&
        container.current.clientWidth &&
        container.current.clientHeight
      ) {
        fit.fit();
        connectionRef.current?.resize(terminal.cols, terminal.rows);
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container.current);
    const input = terminal.onData((data) => {
      if (!abort.signal.aborted) connectionRef.current?.input(data);
    });
    setStatus('terminalConnecting');
    setError('');
    setDirectory('');
    void client.workbench
      .connectTerminal({
        conversationId,
        projectId,
        cols: terminal.cols,
        rows: terminal.rows,
        signal: abort.signal,
        onEvent: (event) => {
          if (abort.signal.aborted) return;
          switch (event.type) {
            case 'opened':
              setStatus('terminalReady');
              setDirectory(event.workingDirectory);
              if (callbacks.current.active) terminal.focus();
              break;
            case 'output':
              terminal.write(event.data);
              break;
            case 'error':
              const restriction = terminalRestriction(event.code);
              if (restriction && onUnavailable) {
                onUnavailable(restriction);
                abort.abort();
                connectionRef.current?.close();
                return;
              }
              setError(event.message);
              setStatus('terminalEnded');
              break;
            case 'closed':
            case 'exit':
            case 'disconnected':
              setStatus('terminalEnded');
              break;
            case 'connected':
              setStatus('terminalConnecting');
              break;
          }
        },
      })
      .then((connection) => {
        if (abort.signal.aborted) connection.close();
        else {
          connectionRef.current = connection;
          resize();
        }
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : callbacks.current.t('workbench.files.failed'),
          );
          setStatus('terminalEnded');
        }
      });
    return () => {
      abort.abort();
      connectionRef.current?.close();
      connectionRef.current = null;
      observer.disconnect();
      input.dispose();
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
    };
  }, [client, conversationId, projectId, attempt, onUnavailable]);
  React.useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal || !container.current) return;
    const styles = getComputedStyle(container.current);
    terminal.options.theme = {
      background: styles.backgroundColor,
      foreground: styles.color,
      cursor: styles.color,
    };
    if (
      active &&
      container.current.clientWidth &&
      container.current.clientHeight
    ) {
      fitRef.current?.fit();
      connectionRef.current?.resize(terminal.cols, terminal.rows);
    }
  }, [active, themeRevision, attempt]);
  if (!conversationId)
    return (
      <p className="p-6 text-sm text-muted-foreground">
        {t('workbench.start.conversationRequired')}
      </p>
    );
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-y px-3 py-2 text-xs">
        <span role="status" className="shrink-0 text-muted-foreground">
          {t(`workbench.files.${status}`)}
        </span>
        <span className="min-w-0 flex-1 truncate" title={directory}>
          {directory}
        </span>
        {status === 'terminalEnded' ? (
          <Button size="sm" variant="ghost" onClick={reconnect}>
            {t('workbench.files.terminalReconnect')}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              connectionRef.current?.close();
              setStatus('terminalEnded');
            }}
          >
            {t('workbench.files.terminalClose')}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="min-h-0 flex-1 p-3">
        <div
          ref={container}
          className="h-full w-full bg-background text-foreground"
          aria-label={t('workbench.start.terminal')}
        />
      </div>
    </div>
  );
}
