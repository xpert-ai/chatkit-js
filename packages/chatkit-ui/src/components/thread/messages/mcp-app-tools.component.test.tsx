import { resolveAppClientTool } from './mcp-app/bridge/app-tools';
import {
  MCP_APP_TOOL_AUTHORIZE,
  MCP_APP_TOOLS_LIST,
  MCP_APP_TOOL_CALL,
} from '@xpert-ai/chatkit-types';
import type { McpAppJsonRpcRequest } from './mcp-app/host';
import {
  WorkbenchContext,
  disabledWorkbenchContext,
} from '../../../workbench/context';
import * as React from 'react';
import type { TMessageComponentMcpAppData } from '@xpert-ai/chatkit-types';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const getResource = vi.fn();
  const rpc = vi.fn();
  const approve = vi.fn();
  const reject = vi.fn();
  const teardown = vi.fn();
  return {
    getResource,
    rpc,
    approve,
    reject,
    teardown,
    submit: vi.fn(),
    client: {
      threads: { get: vi.fn() },
      mcp: {
        apps: { getResource, rpc, approve, reject, teardown },
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
      t: (key: string, values?: { tool?: string }) => {
        const translations: Record<string, string> = {
          'message.mcpApp.loading': 'Loading MCP App',
          'message.mcpApp.fullscreen': 'Open fullscreen',
          'message.mcpApp.pictureInPicture': 'Open picture in picture',
          'message.mcpApp.returnInline': 'Return inline',
          'message.mcpApp.approvalTitle': 'Confirm MCP App action',
          'message.mcpApp.toolApprovalDescription': `Run ${values?.tool ?? ''}`,
          'message.mcpApp.downloadApprovalDescription': 'Download files',
          'message.mcpApp.requestDetails': 'Request details',
          'message.mcpApp.approve': 'Allow',
          'message.mcpApp.reject': 'Reject',
        };
        return translations[key] ?? key;
      },
    },
  }),
}));

import { McpAppMessage, resolveMcpAppSandboxProxy } from './mcp-app';

function asIframe(element: HTMLElement) {
  if (!(element instanceof HTMLIFrameElement)) {
    throw new Error('Expected MCP App to render an iframe');
  }
  return element;
}

function getIframeWindow(iframe: HTMLIFrameElement) {
  const iframeWindow = iframe.contentWindow;
  if (!iframeWindow) {
    throw new Error('Expected MCP App iframe to have a content window');
  }
  return iframeWindow;
}

const data: TMessageComponentMcpAppData = {
  type: 'McpApp',
  appInstanceId: 'app-1',
  appInstanceToken: 'initial-token',
  resourceUri: 'ui://example/app.html',
  toolName: 'initial_tool',
  toolCallId: 'call-1',
  toolsetId: 'toolset-1',
  serverName: 'example',
  title: 'Example App',
};

describe('McpAppMessage reverse tool approval', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
    mocks.getResource.mockResolvedValue({
      uri: data.resourceUri,
      text: '<!doctype html><html><body>App</body></html>',
      appInstanceToken: 'runtime-token',
      toolInput: {},
      toolInfo: {
        name: data.toolName,
        inputSchema: { type: 'object', properties: {} },
      },
    });
    mocks.approve.mockResolvedValue({ approved: true });
    mocks.reject.mockResolvedValue({ approved: false, rejected: true });
    mocks.teardown.mockResolvedValue(undefined);
  });

  async function openView() {
    mocks.rpc.mockImplementation(
      async (_app: string, request: McpAppJsonRpcRequest) => {
        if (
          request.method === MCP_APP_TOOL_AUTHORIZE &&
          !(
            request.params &&
            typeof request.params === 'object' &&
            'approvalId' in request.params
          )
        ) {
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32001,
              message: 'Confirmation required',
              data: {
                approvalId: 'approval',
                risk: 'write',
                expiresAt: Date.now() + 60_000,
              },
            },
          };
        }
        return { jsonrpc: '2.0', id: request.id, result: {} };
      },
    );
    let rendered!: ReturnType<typeof render>;
    await act(async () => {
      rendered = render(<McpAppMessage data={data} messageId="message-1" />);
    });
    const iframe = asIframe(await screen.findByTitle('Example App'));
    const calls = vi.fn();
    const send = (
      value: unknown,
      source: Window | null = iframe.contentWindow,
    ) => {
      window.dispatchEvent(
        new MessageEvent('message', { source, data: value }),
      );
    };
    const post = vi
      .spyOn(getIframeWindow(iframe), 'postMessage')
      .mockImplementation((message) => {
        if (message.method !== 'tools/list' && message.method !== 'tools/call')
          return;
        if (message.method === 'tools/call') calls(message);
        queueMicrotask(() =>
          send({
            jsonrpc: '2.0',
            id: message.id,
            result:
              message.method === 'tools/list'
                ? { tools: [{ name: 'edit', inputSchema: { type: 'object' } }] }
                : { content: [{ type: 'text', text: 'updated' }] },
          }),
        );
      });
    await act(async () => {
      send({
        jsonrpc: '2.0',
        id: 'init',
        method: 'ui/initialize',
        params: { appCapabilities: { tools: { listChanged: true } } },
      });
    });
    const result = await resolveAppClientTool(mocks.client, 'thread-1', {
      name: MCP_APP_TOOLS_LIST,
      args: {},
    });
    const viewId: string = JSON.parse(result!.content).views[0].viewId;
    const invoke = () =>
      resolveAppClientTool(mocks.client, 'thread-1', {
        name: MCP_APP_TOOL_CALL,
        id: 'client-call',
        args: { viewId, name: 'edit', arguments: { text: 'updated' } },
      });
    return { ...rendered, invoke, send, calls, post };
  }

  it('waits for visible confirmation and routes the approved response back to the Agent', async () => {
    const view = await openView();
    let pending: ReturnType<typeof view.invoke>;
    await act(async () => {
      pending = view.invoke();
    });
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(view.calls).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Allow' }));
    });
    expect((await pending!)?.status).toBe('success');
    expect(view.calls).toHaveBeenCalledOnce();
    expect(mocks.approve).toHaveBeenCalledWith(
      'app-1',
      'approval',
      expect.any(Object),
    );
    expect(
      view.post.mock.calls.some(
        ([message]) =>
          typeof message.id === 'string' &&
          message.id.startsWith('xpert-host-approval-'),
      ),
    ).toBe(false);
    view.unmount();
  });

  it('returns a rejection without invoking the App', async () => {
    const view = await openView();
    let pending: ReturnType<typeof view.invoke>;
    await act(async () => {
      pending = view.invoke();
    });
    await screen.findByRole('alertdialog');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    });
    expect((await pending!)?.status).toBe('error');
    expect(view.calls).not.toHaveBeenCalled();
    view.unmount();
  });

  it('invalidates a pending approval on unmount and blocks App-origin host authorization', async () => {
    const view = await openView();
    mocks.rpc.mockClear();
    await act(async () => {
      view.send({
        jsonrpc: '2.0',
        id: 'forged',
        method: MCP_APP_TOOL_AUTHORIZE,
        params: {},
      });
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(view.post).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'forged',
        error: expect.objectContaining({ code: -32601 }),
      }),
      '*',
    );
    let pending: ReturnType<typeof view.invoke>;
    await act(async () => {
      pending = view.invoke();
    });
    await screen.findByRole('alertdialog');
    view.unmount();
    expect((await pending!)?.status).toBe('error');
    expect(view.calls).not.toHaveBeenCalled();
  });
});
