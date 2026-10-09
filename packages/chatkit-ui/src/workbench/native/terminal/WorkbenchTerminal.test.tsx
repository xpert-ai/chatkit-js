import * as React from 'react';
import {
  Client,
  type TerminalConnection,
  type TerminalOpenOptions,
} from '@xpert-ai/xpert-sdk';
import {
  act,
  cleanup,
  fireEvent,
  render as renderComponent,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../../../i18n';
import WorkbenchTerminal from './WorkbenchTerminal';
import { ThemeProvider } from '../../../providers/Theme';

const render = (element: React.ReactElement) =>
  renderComponent(element, { wrapper: ThemeProvider });

const terminals = vi.hoisted(
  () =>
    [] as Array<{
      disposed: boolean;
      write: ReturnType<typeof vi.fn>;
      focus: ReturnType<typeof vi.fn>;
      fit: ReturnType<typeof vi.fn>;
    }>,
);
vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    options = {};
    disposed = false;
    write = vi.fn();
    focus = vi.fn();
    fit = vi.fn(() => {
      if (this.disposed) throw new Error('fit after dispose');
    });
    constructor() {
      terminals.push(this);
    }
    loadAddon(addon: { activate(terminal: object): void }) {
      addon.activate(this);
    }
    open() {}
    onData() {
      return { dispose: vi.fn() };
    }
    dispose() {
      this.disposed = true;
    }
  },
}));
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    terminal?: { fit(): void };
    activate(terminal: { fit(): void }) {
      this.terminal = terminal;
    }
    fit() {
      this.terminal?.fit();
    }
  },
}));

const resizeCallbacks: Array<() => void> = [];
beforeEach(() => {
  terminals.length = 0;
  resizeCallbacks.length = 0;
  setLanguage('en-US');
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(480);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resizeCallbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setLanguage('en-US');
});

function setup() {
  const client = new Client({ apiUrl: 'https://example.test/api/ai' });
  const opens: TerminalOpenOptions[] = [];
  const connections: TerminalConnection[] = [];
  const connect = vi
    .spyOn(client.workbench, 'connectTerminal')
    .mockImplementation(async (options) => {
      opens.push(options);
      const connection = { input: vi.fn(), resize: vi.fn(), close: vi.fn() };
      connections.push(connection);
      return connection;
    });
  return { client, opens, connections, connect };
}

describe('WorkbenchTerminal lifetime', () => {
  it('ignores old resize and output callbacks after StrictMode cleanup', async () => {
    const { client, opens, connections } = setup();
    const view = renderComponent(
      <React.StrictMode>
        <ThemeProvider>
          <WorkbenchTerminal client={client} conversationId="c1" active />
        </ThemeProvider>
      </React.StrictMode>,
    );
    await act(async () => {});
    expect(opens).toHaveLength(2);
    expect(terminals[0].disposed).toBe(true);
    expect(opens[0].signal?.aborted).toBe(true);
    expect(connections[0].close).toHaveBeenCalled();
    const oldFits = terminals[0].fit.mock.calls.length;
    act(() => {
      resizeCallbacks[0]();
      opens[0].onEvent({ type: 'output', sessionId: 'old', data: 'stale' });
      opens[1].onEvent({
        type: 'output',
        sessionId: 'new',
        data: '中文 output',
      });
    });
    expect(terminals[0].fit).toHaveBeenCalledTimes(oldFits);
    expect(terminals[0].write).not.toHaveBeenCalled();
    expect(terminals[1].write).toHaveBeenCalledWith('中文 output');
    view.unmount();
    expect(terminals[1].disposed).toBe(true);
    expect(connections[1].close).toHaveBeenCalled();
  });

  it('keeps its session on language and visibility changes without focusing a hidden tab', async () => {
    const { client, opens, connect } = setup();
    const view = render(
      <WorkbenchTerminal client={client} conversationId="c1" active />,
    );
    await act(async () => {});
    view.rerender(
      <WorkbenchTerminal client={client} conversationId="c1" active={false} />,
    );
    act(() => {
      setLanguage('zh-CN');
      opens[0].onEvent({
        type: 'opened',
        sessionId: 's1',
        requestId: 'r1',
        provider: 'test',
        workingDirectory: '/workspace',
      });
    });
    expect(connect).toHaveBeenCalledTimes(1);
    expect(terminals[0].focus).not.toHaveBeenCalled();
    expect(terminals[0].disposed).toBe(false);
    expect(screen.getByText('/workspace')).toBeVisible();
  });

  it('reports a typed restriction and closes the unavailable connection', async () => {
    const { client, opens, connections } = setup();
    const onUnavailable = vi.fn();
    render(
      <WorkbenchTerminal
        client={client}
        conversationId="c1"
        active
        onUnavailable={onUnavailable}
      />,
    );
    await act(async () => {});
    act(() =>
      opens[0].onEvent({
        type: 'error',
        code: 'computer_desktop_required',
        message: 'Server explanation',
      }),
    );
    expect(onUnavailable).toHaveBeenCalledWith('computer_desktop_required');
    expect(opens[0].signal?.aborted).toBe(true);
    expect(connections[0].close).toHaveBeenCalled();
  });

  it('still allows retrying a transient connection failure', async () => {
    const { client, opens, connections, connect } = setup();
    render(<WorkbenchTerminal client={client} conversationId="c1" active />);
    await act(async () => {});
    act(() =>
      opens[0].onEvent({
        type: 'error',
        code: 'connection',
        message: 'Network unavailable',
      }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Network unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    await act(async () => {});
    expect(connect).toHaveBeenCalledTimes(2);
    expect(connections[0].close).toHaveBeenCalled();
    expect(terminals[0].disposed).toBe(true);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
