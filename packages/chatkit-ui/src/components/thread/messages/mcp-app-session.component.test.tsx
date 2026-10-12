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
  const approve = vi.fn();
  return {
    getResource,
    getHistory,
    resume,
    rpc,
    teardown,
    approve,
    submit: vi.fn(),
    client: {
      mcp: {
        apps: { getResource, getHistory, resume, rpc, teardown, approve },
      },
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

async function currentIframe() {
  const iframe = await screen.findByTitle('Example App');
  if (!(iframe instanceof HTMLIFrameElement) || !iframe.contentWindow)
    throw new Error('Missing app iframe');
  return iframe;
}

async function message(
  iframe: HTMLIFrameElement,
  id: string,
  method: string,
  params = {},
) {
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        source: iframe.contentWindow,
        data: { jsonrpc: '2.0', id, method, params },
      }),
    );
  });
}

async function expire(request: ReturnType<typeof deferred<unknown>>) {
  await act(async () => {
    request.reject(new McpAppSessionError('MCP_APP_SESSION_EXPIRED'));
  });
  await screen.findByRole('region', { name: copy.title });
}

async function restore() {
  fireEvent.click(screen.getByRole('button', { name: copy.resume }));
  return currentIframe();
}

describe('MCP App session response isolation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mocks.rpc.mockReset();
    mocks.getResource.mockResolvedValue(resource);
    mocks.getHistory.mockResolvedValue(snapshot);
    mocks.resume.mockResolvedValue(resource);
    mocks.teardown.mockResolvedValue(undefined);
  });

  it('does not let an in-flight resume success override a current-session 403', async () => {
    const expiredRpc = deferred<unknown>();
    const forbiddenRpc = deferred<unknown>();
    const pendingResume = deferred<typeof resource>();
    mocks.rpc
      .mockReturnValueOnce(expiredRpc.promise)
      .mockReturnValueOnce(forbiddenRpc.promise);
    mocks.resume.mockReturnValueOnce(pendingResume.promise);
    render(<McpAppMessage data={data} messageId="message-1" />);
    const iframe = await currentIframe();
    await message(iframe, 'expires', 'tools/list');
    await message(iframe, 'denied', 'tools/list');
    await expire(expiredRpc);
    fireEvent.click(screen.getByRole('button', { name: copy.resume }));
    await waitFor(() => expect(mocks.resume).toHaveBeenCalledTimes(1));
    await act(async () => {
      forbiddenRpc.reject(denied());
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.forbidden);
    await act(async () => {
      pendingResume.resolve(resource);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(copy.forbidden);
    expect(screen.queryByTitle('Example App')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: copy.title }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['tools/list', {}],
    [
      'ui/message',
      { role: 'user', content: [{ type: 'text', text: 'old follow-up' }] },
    ],
    ['ui/open-link', { url: 'https://example.com/old-session' }],
  ])(
    'drops a successful old %s response and its side effects after restoration',
    async (method, params) => {
      const oldRpc = deferred<unknown>();
      const expiredRpc = deferred<unknown>();
      mocks.rpc
        .mockReturnValueOnce(oldRpc.promise)
        .mockReturnValueOnce(expiredRpc.promise);
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      render(<McpAppMessage data={data} messageId="message-1" />);
      const iframe = await currentIframe();
      await message(iframe, 'old-request', method, params);
      await message(iframe, 'expires', 'tools/list');
      await expire(expiredRpc);
      const restored = await restore();
      const post = vi.spyOn(restored.contentWindow!, 'postMessage');
      await act(async () => {
        oldRpc.resolve({
          jsonrpc: '2.0',
          id: 'old-request',
          result: { content: [{ type: 'text', text: 'STALE RESULT' }] },
        });
      });
      expect(post).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: 'old-request' }),
        '*',
      );
      expect(JSON.stringify(post.mock.calls)).not.toContain('STALE RESULT');
      expect(mocks.submit).not.toHaveBeenCalled();
      expect(open).not.toHaveBeenCalled();
      expect(screen.getByTitle('Example App')).toBe(restored);
    },
  );

  it('discards an old host refresh result and enables refresh for the restored session', async () => {
    const refreshResource = {
      ...resource,
      refresh: { toolName: 'read_latest', arguments: {} },
    };
    mocks.getResource.mockResolvedValueOnce(refreshResource);
    mocks.resume.mockResolvedValueOnce(refreshResource);
    const oldRefresh = deferred<unknown>();
    const expiredRpc = deferred<unknown>();
    mocks.rpc
      .mockReturnValueOnce(oldRefresh.promise)
      .mockReturnValueOnce(expiredRpc.promise)
      .mockResolvedValueOnce({
        result: { content: [{ type: 'text', text: 'CURRENT RESULT' }] },
      });
    render(<McpAppMessage data={data} messageId="message-1" />);
    const iframe = await currentIframe();
    await message(iframe, 'init', 'ui/initialize');
    fireEvent.click(
      screen.getByRole('button', { name: 'message.mcpApp.refresh' }),
    );
    await message(iframe, 'expires', 'tools/list');
    await expire(expiredRpc);
    const restored = await restore();
    await message(restored, 'init-new', 'ui/initialize');
    const post = vi.spyOn(restored.contentWindow!, 'postMessage');
    await act(async () => {
      oldRefresh.resolve({
        result: { content: [{ type: 'text', text: 'STALE REFRESH' }] },
      });
    });
    expect(JSON.stringify(post.mock.calls)).not.toContain('STALE REFRESH');
    const refreshButton = screen.getByRole('button', {
      name: 'message.mcpApp.refresh',
    });
    expect(refreshButton).toBeEnabled();
    await act(async () => {
      fireEvent.click(refreshButton);
    });
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'ui/notifications/tool-result',
        params: { content: [{ type: 'text', text: 'CURRENT RESULT' }] },
      }),
      '*',
    );
  });

  it('ignores an old teardown completion and allows the restored app to close', async () => {
    const expiredRpc = deferred<unknown>();
    const oldTeardown = deferred<void>();
    mocks.rpc.mockReturnValueOnce(expiredRpc.promise);
    mocks.teardown.mockReturnValueOnce(oldTeardown.promise);
    render(<McpAppMessage data={data} messageId="message-1" />);
    const iframe = await currentIframe();
    await message(iframe, 'expires', 'tools/list');
    await message(iframe, 'close-old', 'ui/notifications/request-teardown');
    await expire(expiredRpc);
    const restored = await restore();
    await act(async () => {
      oldTeardown.resolve();
    });
    expect(screen.getByTitle('Example App')).toBe(restored);
    await message(restored, 'close-new', 'ui/notifications/request-teardown');
    await waitFor(() =>
      expect(screen.queryByTitle('Example App')).not.toBeInTheDocument(),
    );
    expect(mocks.teardown).toHaveBeenCalledTimes(2);
  });

  it('does not retry an old approved tool after its session has been replaced', async () => {
    const approval = deferred<unknown>();
    const expiredRpc = deferred<unknown>();
    mocks.approve.mockReturnValueOnce(approval.promise);
    mocks.rpc
      .mockResolvedValueOnce({
        jsonrpc: '2.0',
        id: 'write',
        error: {
          code: -32001,
          message: 'Approval required',
          data: {
            approvalRequired: true,
            approvalId: 'approval-old',
            kind: 'tool',
            risk: 'write',
            toolName: 'update_item',
            expiresAt: Date.now() + 60000,
          },
        },
      })
      .mockReturnValueOnce(expiredRpc.promise);
    render(<McpAppMessage data={data} messageId="message-1" />);
    const iframe = await currentIframe();
    await message(iframe, 'write', 'tools/call', {
      name: 'update_item',
      arguments: {},
    });
    await screen.findByRole('alertdialog');
    fireEvent.click(
      screen.getByRole('button', { name: 'message.mcpApp.approve' }),
    );
    await waitFor(() => expect(mocks.approve).toHaveBeenCalledTimes(1));
    await message(iframe, 'expires', 'tools/list');
    await expire(expiredRpc);
    await restore();
    await act(async () => {
      approval.resolve({ approved: true });
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
