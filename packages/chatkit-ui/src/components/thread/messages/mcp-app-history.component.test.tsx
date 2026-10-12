import type { TMessageComponentMcpAppData } from '@xpert-ai/chatkit-types';
import { McpAppSessionError, type McpAppHistory } from '@xpert-ai/xpert-sdk';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import translations from '../../../i18n/locales/en-US.json';

const mocks = vi.hoisted(() => {
  const getResource = vi.fn();
  const getHistory = vi.fn();
  const resume = vi.fn();
  const rpc = vi.fn();
  const teardown = vi.fn();
  return {
    getResource,
    getHistory,
    resume,
    rpc,
    teardown,
    submit: vi.fn(),
    client: {
      mcp: { apps: { getResource, getHistory, resume, rpc, teardown } },
    },
  };
});

vi.mock('../../../providers/Stream', () => ({
  useStreamContext: () => ({
    client: mocks.client,
    isLoading: false,
    submit: mocks.submit,
    threadId: 'thread-1',
    conversationId: 'conversation-1',
  }),
}));

vi.mock('../../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    i18n: {
      language: 'en-US',
      t: (key: string) => {
        const prefix = 'message.mcpApp.history.';
        return key.startsWith(prefix)
          ? translations.message.mcpApp.history[
              key.slice(
                prefix.length,
              ) as keyof typeof translations.message.mcpApp.history
            ]
          : key;
      },
    },
  }),
}));

import { McpAppMessage } from './mcp-app';

const copy = translations.message.mcpApp.history;
const data: TMessageComponentMcpAppData = {
  type: 'McpApp',
  appInstanceId: 'app-1',
  appInstanceToken: 'expired-token',
  resourceUri: 'ui://example/app.html',
  toolName: 'example.search',
  toolCallId: 'call-1',
  toolsetId: 'toolset-1',
  serverName: 'example',
  title: 'Example App',
  toolResult: { content: [{ type: 'text', text: 'UNVERIFIED CLIENT RESULT' }] },
};
const savedContent = [
  { type: 'text', text: 'First saved result\nSecond saved result' },
];
const snapshot: McpAppHistory = {
  appInstanceId: data.appInstanceId,
  toolInput: { query: 'saved query' },
  toolResult: {
    content: savedContent,
    structuredContent: { rows: [{ name: 'A', value: 6 }] },
  },
  toolResultTruncated: false,
  createdAt: Date.UTC(2026, 9, 12, 2, 30),
  canResume: true,
};
const resource = {
  text: '<!doctype html><html><body>Restored app</body></html>',
  appInstanceToken: 'renewed-token',
  toolInput: snapshot.toolInput,
  toolResult: snapshot.toolResult,
};
const denied = () =>
  Object.assign(new Error('Forbidden server internals'), { status: 403 });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

async function showHistory() {
  render(<McpAppMessage data={data} messageId="message-1" />);
  return screen.findByRole('region', { name: copy.title });
}

describe('MCP App authorized history fallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mocks.getResource.mockRejectedValue(
      new McpAppSessionError('MCP_APP_SESSION_EXPIRED'),
    );
    mocks.getHistory.mockResolvedValue(snapshot);
    mocks.resume.mockResolvedValue(resource);
    mocks.teardown.mockResolvedValue(undefined);
  });

  it('loads an active app without requesting history or restoring a session', async () => {
    mocks.getResource.mockResolvedValueOnce(resource);
    render(<McpAppMessage data={data} messageId="message-1" />);
    await screen.findByTitle('Example App');
    expect(mocks.getHistory).not.toHaveBeenCalled();
    expect(mocks.resume).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('shows saved text, generic structured data and query time after expiry without running a tool', async () => {
    const region = await showHistory();
    expect(screen.getByText(copy.expired)).toBeVisible();
    expect(region).toHaveTextContent('First saved result');
    expect(region).toHaveTextContent('Second saved result');
    expect(region.querySelector('time')).toHaveAttribute(
      'datetime',
      '2026-10-12T02:30:00.000Z',
    );
    fireEvent.click(screen.getByText(copy.structured));
    expect(region).toHaveTextContent('"name": "A"');
    expect(
      screen.queryByText('UNVERIFIED CLIENT RESULT'),
    ).not.toBeInTheDocument();
    expect(mocks.getHistory).toHaveBeenCalledWith(
      'app-1',
      { messageId: 'message-1' },
      { signal: expect.any(AbortSignal) },
    );
    expect(mocks.resume).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it('distinguishes a lost session from an expired session', async () => {
    mocks.getResource.mockRejectedValue(
      new McpAppSessionError('MCP_APP_SESSION_UNAVAILABLE'),
    );
    await showHistory();
    expect(screen.getByText(copy.unavailable)).toBeVisible();
    expect(screen.queryByText(copy.expired)).not.toBeInTheDocument();
  });

  it('does not infer expiry from error message text or render server diagnostics', async () => {
    mocks.getResource.mockRejectedValue(
      new Error('MCP_APP_SESSION_EXPIRED internal-token'),
    );
    await showHistory();
    expect(screen.getByText(copy.unavailable)).toBeVisible();
    expect(screen.queryByText(copy.expired)).not.toBeInTheDocument();
    expect(screen.queryByText(/internal-token/)).not.toBeInTheDocument();
  });

  it('keeps a genuine resource 403 denied and never reveals client or history results', async () => {
    mocks.getResource.mockRejectedValue(denied());
    render(<McpAppMessage data={data} messageId="message-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.forbidden);
    expect(mocks.getHistory).not.toHaveBeenCalled();
    expect(
      screen.queryByText('UNVERIFIED CLIENT RESULT'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: copy.resume }),
    ).not.toBeInTheDocument();
  });

  it('uses current history ACL and does not replace history 403 with message data', async () => {
    mocks.getHistory.mockRejectedValue(denied());
    render(<McpAppMessage data={data} messageId="message-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.forbidden);
    expect(
      screen.queryByText('UNVERIFIED CLIENT RESULT'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: copy.title }),
    ).not.toBeInTheDocument();
  });

  it('does not request history or offer restoration without a persisted message id', async () => {
    render(<McpAppMessage data={data} />);
    expect(await screen.findByText(copy.missing)).toBeVisible();
    expect(mocks.getHistory).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: copy.resume }),
    ).not.toBeInTheDocument();
  });

  it('distinguishes missing, empty and truncated result snapshots', async () => {
    mocks.getHistory.mockResolvedValue({
      ...snapshot,
      toolResult: undefined,
      canResume: false,
    });
    const { rerender } = render(
      <McpAppMessage data={data} messageId="message-1" />,
    );
    expect(await screen.findByText(copy.missing)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: copy.resume }),
    ).not.toBeInTheDocument();
    mocks.getHistory.mockResolvedValue({
      ...snapshot,
      toolResult: { content: [] },
    });
    rerender(
      <McpAppMessage
        data={{ ...data, appInstanceId: 'app-2' }}
        messageId="message-2"
      />,
    );
    expect(await screen.findByText(copy.empty)).toBeVisible();
    mocks.getHistory.mockResolvedValue({
      ...snapshot,
      toolResult: undefined,
      toolResultTruncated: true,
    });
    rerender(
      <McpAppMessage
        data={{ ...data, appInstanceId: 'app-3' }}
        messageId="message-3"
      />,
    );
    expect(await screen.findByText(copy.truncated)).toBeVisible();
    expect(screen.getByText(copy.truncatedMissing)).toBeVisible();
  });

  it('keeps retained content visible when a snapshot is truncated', async () => {
    mocks.getHistory.mockResolvedValue({
      ...snapshot,
      toolResultTruncated: true,
    });
    const region = await showHistory();
    expect(screen.getByText(copy.truncated)).toBeVisible();
    expect(region).toHaveTextContent('First saved result');
  });

  it('safely renders text and structured-only results without interpreting plugin schemas', async () => {
    mocks.getHistory.mockResolvedValue({
      ...snapshot,
      toolResult: {
        content: [],
        structuredContent: { arbitrary: '<script>secret()</script>' },
      },
    });
    const region = await showHistory();
    expect(region.querySelector('details')).toHaveAttribute('open');
    expect(region).toHaveTextContent('<script>secret()</script>');
    expect(region.querySelector('script')).toBeNull();
  });

  it('shows a localized failure if history cannot be fetched, without showing unverified client data', async () => {
    mocks.getHistory.mockRejectedValue(new Error('offline diagnostics'));
    render(<McpAppMessage data={data} messageId="message-1" />);
    expect(await screen.findByText(copy.unavailableSnapshot)).toBeVisible();
    expect(
      screen.queryByText('UNVERIFIED CLIENT RESULT'),
    ).not.toBeInTheDocument();
  });

  it('restores interaction only on an explicit click and keeps the snapshot visible while busy', async () => {
    const pending = deferred<typeof resource>();
    mocks.resume.mockReturnValue(pending.promise);
    const region = await showHistory();
    fireEvent.click(screen.getByRole('button', { name: copy.resume }));
    expect(screen.getByRole('button', { name: copy.resuming })).toBeDisabled();
    expect(region).toHaveTextContent('First saved result');
    expect(mocks.resume).toHaveBeenCalledTimes(1);
    expect(mocks.resume).toHaveBeenCalledWith(
      'app-1',
      { messageId: 'message-1' },
      { signal: expect.any(AbortSignal) },
    );
    await act(async () => {
      pending.resolve(resource);
    });
    const iframe = await screen.findByTitle('Example App');
    expect(iframe).toHaveAttribute(
      'srcdoc',
      expect.stringContaining('Restored app'),
    );
    expect(
      screen.queryByRole('region', { name: copy.title }),
    ).not.toBeInTheDocument();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(mocks.getResource).toHaveBeenCalledTimes(1);
  });

  it('replays only the authorized result when the restored iframe initializes', async () => {
    await showHistory();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: copy.resume }));
    });
    const iframe = await screen.findByTitle('Example App');
    if (!(iframe instanceof HTMLIFrameElement) || !iframe.contentWindow)
      throw new Error('Missing app iframe');
    const post = vi.spyOn(iframe.contentWindow, 'postMessage');
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframe.contentWindow,
          data: {
            jsonrpc: '2.0',
            id: 'init',
            method: 'ui/initialize',
            params: {},
          },
        }),
      );
    });
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'ui/notifications/tool-result',
        params: expect.objectContaining({
          content: savedContent,
        }),
      }),
      '*',
    );
    expect(JSON.stringify(post.mock.calls)).not.toContain(
      'UNVERIFIED CLIENT RESULT',
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('does not replay unverified message data when the resumed resource has no saved result', async () => {
    mocks.resume.mockResolvedValueOnce({ ...resource, toolResult: undefined });
    await showHistory();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: copy.resume }));
    });
    const iframe = await screen.findByTitle('Example App');
    if (!(iframe instanceof HTMLIFrameElement) || !iframe.contentWindow)
      throw new Error('Missing app iframe');
    const post = vi.spyOn(iframe.contentWindow, 'postMessage');
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframe.contentWindow,
          data: {
            jsonrpc: '2.0',
            id: 'init',
            method: 'ui/initialize',
            params: {},
          },
        }),
      );
    });
    expect(post).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'ui/notifications/tool-result' }),
      '*',
    );
    expect(JSON.stringify(post.mock.calls)).not.toContain(
      'UNVERIFIED CLIENT RESULT',
    );
  });

  it('switches an active iframe to authorized history when an RPC reports expiry', async () => {
    mocks.getResource.mockResolvedValueOnce(resource);
    mocks.rpc.mockRejectedValueOnce(
      new McpAppSessionError('MCP_APP_SESSION_EXPIRED'),
    );
    render(<McpAppMessage data={data} messageId="message-1" />);
    const iframe = await screen.findByTitle('Example App');
    if (!(iframe instanceof HTMLIFrameElement))
      throw new Error('Missing app iframe');
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframe.contentWindow,
          data: {
            jsonrpc: '2.0',
            id: 'runtime-query',
            method: 'tools/list',
            params: {},
          },
        }),
      );
    });
    expect(
      await screen.findByRole('region', { name: copy.title }),
    ).toHaveTextContent('First saved result');
    expect(screen.getByText(copy.expired)).toBeVisible();
    expect(screen.queryByTitle('Example App')).not.toBeInTheDocument();
    expect(mocks.resume).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.getHistory).toHaveBeenCalledTimes(1);
  });

  it('removes the active iframe when an RPC reports revoked permission', async () => {
    mocks.getResource.mockResolvedValueOnce(resource);
    mocks.rpc.mockRejectedValueOnce(denied());
    render(<McpAppMessage data={data} messageId="message-1" />);
    const iframe = await screen.findByTitle('Example App');
    if (!(iframe instanceof HTMLIFrameElement))
      throw new Error('Missing app iframe');
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframe.contentWindow,
          data: {
            jsonrpc: '2.0',
            id: 'runtime-query',
            method: 'tools/list',
            params: {},
          },
        }),
      );
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.forbidden);
    expect(screen.queryByTitle('Example App')).not.toBeInTheDocument();
    expect(
      screen.queryByText('UNVERIFIED CLIENT RESULT'),
    ).not.toBeInTheDocument();
    expect(mocks.getHistory).not.toHaveBeenCalled();
    expect(mocks.resume).not.toHaveBeenCalled();
  });

  it.each([
    ['expired', new McpAppSessionError('MCP_APP_SESSION_EXPIRED')],
    ['forbidden', denied()],
  ])(
    'ignores an old RPC %s after restoring a new session',
    async (_status, oldError) => {
      const firstRpc = deferred<unknown>();
      const oldRpc = deferred<unknown>();
      mocks.getResource.mockResolvedValueOnce(resource);
      mocks.rpc
        .mockReturnValueOnce(firstRpc.promise)
        .mockReturnValueOnce(oldRpc.promise);
      render(<McpAppMessage data={data} messageId="message-1" />);
      const iframe = await screen.findByTitle('Example App');
      if (!(iframe instanceof HTMLIFrameElement))
        throw new Error('Missing app iframe');
      await act(async () => {
        for (const id of ['first', 'old']) {
          window.dispatchEvent(
            new MessageEvent('message', {
              source: iframe.contentWindow,
              data: { jsonrpc: '2.0', id, method: 'tools/list', params: {} },
            }),
          );
        }
      });
      await act(async () => {
        firstRpc.reject(new McpAppSessionError('MCP_APP_SESSION_EXPIRED'));
      });
      await screen.findByRole('region', { name: copy.title });
      fireEvent.click(screen.getByRole('button', { name: copy.resume }));
      const restored = await screen.findByTitle('Example App');
      await act(async () => {
        oldRpc.reject(oldError);
      });
      expect(screen.getByTitle('Example App')).toBe(restored);
      expect(
        screen.queryByRole('region', { name: copy.title }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(copy.forbidden)).not.toBeInTheDocument();
      expect(mocks.getHistory).toHaveBeenCalledTimes(1);
    },
  );

  it('honors a current-session 403 while a concurrent expiry history lookup is pending', async () => {
    const firstRpc = deferred<unknown>();
    const deniedRpc = deferred<unknown>();
    const pendingHistory = deferred<McpAppHistory>();
    mocks.getResource.mockResolvedValueOnce(resource);
    mocks.getHistory.mockReturnValueOnce(pendingHistory.promise);
    mocks.rpc
      .mockReturnValueOnce(firstRpc.promise)
      .mockReturnValueOnce(deniedRpc.promise);
    render(<McpAppMessage data={data} messageId="message-1" />);
    const iframe = await screen.findByTitle('Example App');
    if (!(iframe instanceof HTMLIFrameElement))
      throw new Error('Missing app iframe');
    await act(async () => {
      for (const id of ['first', 'denied']) {
        window.dispatchEvent(
          new MessageEvent('message', {
            source: iframe.contentWindow,
            data: { jsonrpc: '2.0', id, method: 'tools/list', params: {} },
          }),
        );
      }
    });
    await act(async () => {
      firstRpc.reject(new McpAppSessionError('MCP_APP_SESSION_EXPIRED'));
    });
    await waitFor(() => expect(mocks.getHistory).toHaveBeenCalledTimes(1));
    await act(async () => {
      deniedRpc.reject(denied());
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.forbidden);
    await act(async () => {
      pendingHistory.resolve(snapshot);
    });
    expect(
      screen.queryByRole('region', { name: copy.title }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTitle('Example App')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(copy.forbidden);
  });

  it('retains history and supports retry after a restoration failure', async () => {
    mocks.resume.mockRejectedValueOnce(new Error('provider offline'));
    const region = await showHistory();
    fireEvent.click(screen.getByRole('button', { name: copy.resume }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      copy.resumeFailed,
    );
    expect(region).toHaveTextContent('First saved result');
    fireEvent.click(screen.getByRole('button', { name: copy.resume }));
    await screen.findByTitle('Example App');
    expect(mocks.resume).toHaveBeenCalledTimes(2);
  });

  it('removes a previously authorized snapshot when restoration now returns 403', async () => {
    mocks.resume.mockRejectedValue(denied());
    await showHistory();
    fireEvent.click(screen.getByRole('button', { name: copy.resume }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.forbidden);
    expect(
      screen.queryByRole('region', { name: copy.title }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: copy.resume }),
    ).not.toBeInTheDocument();
  });

  it('ignores stale history responses when the message identity changes', async () => {
    const pending = deferred<McpAppHistory>();
    mocks.getHistory.mockReturnValueOnce(pending.promise);
    const { rerender } = render(
      <McpAppMessage data={data} messageId="message-1" />,
    );
    await waitFor(() => expect(mocks.getHistory).toHaveBeenCalledTimes(1));
    mocks.getResource.mockResolvedValue(resource);
    rerender(
      <McpAppMessage
        data={{ ...data, appInstanceId: 'app-2', title: 'New App' }}
        messageId="message-2"
      />,
    );
    await screen.findByTitle('New App');
    await act(async () => {
      pending.resolve(snapshot);
    });
    expect(
      screen.queryByRole('region', { name: copy.title }),
    ).not.toBeInTheDocument();
    expect(screen.getByTitle('New App')).toBeInTheDocument();
  });

  it('ignores a stale resume response after another card becomes active', async () => {
    const pending = deferred<typeof resource>();
    mocks.resume.mockReturnValueOnce(pending.promise);
    const { rerender } = render(
      <McpAppMessage data={data} messageId="message-1" />,
    );
    await screen.findByRole('region', { name: copy.title });
    fireEvent.click(screen.getByRole('button', { name: copy.resume }));
    mocks.getResource.mockResolvedValue({
      ...resource,
      text: '<html><body>New instance</body></html>',
    });
    rerender(
      <McpAppMessage
        data={{ ...data, appInstanceId: 'app-2', title: 'New App' }}
        messageId="message-2"
      />,
    );
    await screen.findByTitle('New App');
    await act(async () => {
      pending.resolve(resource);
    });
    expect(screen.getByTitle('New App')).toHaveAttribute(
      'srcdoc',
      expect.stringContaining('New instance'),
    );
    expect(screen.getByTitle('New App')).not.toHaveAttribute(
      'srcdoc',
      expect.stringContaining('Restored app'),
    );
  });
});
