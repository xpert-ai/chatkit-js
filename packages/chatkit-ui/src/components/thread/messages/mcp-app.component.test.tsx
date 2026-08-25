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

describe('McpAppMessage host controls', () => {
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

  it('requires visible approval and retries the exact tool call with approvalId', async () => {
    const expiresAt = Date.now() + 60_000;
    mocks.rpc
      .mockResolvedValueOnce({
        jsonrpc: '2.0',
        id: 'rpc-1',
        error: {
          code: -32001,
          message: 'Approval required',
          data: { approvalId: 'approval-1', risk: 'write', expiresAt },
        },
      })
      .mockResolvedValueOnce({
        jsonrpc: '2.0',
        id: 'rpc-1',
        result: { content: [{ type: 'text', text: 'updated' }] },
      });

    render(<McpAppMessage data={data} messageId="message-1" />);
    const iframe = asIframe(await screen.findByTitle('Example App'));
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-downloads');
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(iframe.srcdoc).toContain("form-action 'none'");
    const postMessage = vi.spyOn(getIframeWindow(iframe), 'postMessage');

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframe.contentWindow,
          data: {
            jsonrpc: '2.0',
            id: 'rpc-1',
            method: 'tools/call',
            params: {
              name: 'update_record',
              arguments: { id: 'record-1', title: 'Updated' },
            },
          },
        }),
      );
    });

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getAllByText('update_record', { exact: false })).toHaveLength(
      2,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Allow' }));

    await waitFor(() => {
      expect(mocks.approve).toHaveBeenCalledWith(
        'app-1',
        'approval-1',
        expect.objectContaining({ token: 'runtime-token' }),
      );
      expect(mocks.rpc).toHaveBeenLastCalledWith(
        'app-1',
        expect.objectContaining({
          method: 'tools/call',
          params: expect.objectContaining({
            name: 'update_record',
            approvalId: 'approval-1',
          }),
        }),
        expect.objectContaining({ token: 'runtime-token' }),
      );
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rpc-1', result: expect.any(Object) }),
      '*',
    );
  });

  it('honors App-requested fullscreen mode and allows returning inline', async () => {
    mocks.rpc.mockResolvedValueOnce({
      jsonrpc: '2.0',
      id: 'display-1',
      result: { mode: 'fullscreen' },
    });

    const { container } = render(
      <McpAppMessage data={data} messageId="message-1" />,
    );
    const iframe = asIframe(await screen.findByTitle('Example App'));
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframe.contentWindow,
          data: {
            jsonrpc: '2.0',
            id: 'display-1',
            method: 'ui/request-display-mode',
            params: { mode: 'fullscreen' },
          },
        }),
      );
    });

    await waitFor(() => {
      expect(
        container.querySelector('[data-display-mode="fullscreen"]'),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Return inline' }));
    expect(
      container.querySelector('[data-display-mode="inline"]'),
    ).toBeInTheDocument();
  });

  it('advertises standard message modalities, styles, downloads, and pip mode', async () => {
    render(<McpAppMessage data={data} messageId="message-1" />);
    const iframe = asIframe(await screen.findByTitle('Example App'));
    const iframeWindow = getIframeWindow(iframe);
    const postMessage = vi.spyOn(iframeWindow, 'postMessage');

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframeWindow,
          data: {
            jsonrpc: '2.0',
            id: 'initialize-1',
            method: 'ui/initialize',
            params: {
              protocolVersion: '2026-01-26',
              appCapabilities: {
                availableDisplayModes: ['inline', 'fullscreen', 'pip'],
              },
            },
          },
        }),
      );
    });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'initialize-1',
        result: expect.objectContaining({
          hostCapabilities: expect.objectContaining({
            downloadFile: {},
            message: {
              text: {},
              image: {},
              audio: {},
              resource: {},
              resourceLink: {},
            },
          }),
          hostContext: expect.objectContaining({
            styles: { variables: expect.any(Object) },
            availableDisplayModes: ['inline', 'fullscreen', 'pip'],
          }),
        }),
      }),
      '*',
    );
  });

  it('preserves multimodal ui/message blocks as text and inline files', async () => {
    mocks.rpc.mockResolvedValueOnce({
      jsonrpc: '2.0',
      id: 'message-1',
      result: {},
    });

    render(<McpAppMessage data={data} messageId="message-1" />);
    const iframe = asIframe(await screen.findByTitle('Example App'));
    const iframeWindow = getIframeWindow(iframe);

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframeWindow,
          data: {
            jsonrpc: '2.0',
            id: 'message-1',
            method: 'ui/message',
            params: {
              role: 'user',
              content: [
                { type: 'text', text: 'Describe these' },
                { type: 'image', data: 'aW1hZ2U=', mimeType: 'image/png' },
                { type: 'audio', data: 'YXVkaW8=', mimeType: 'audio/wav' },
                {
                  type: 'resource',
                  resource: {
                    uri: 'mcp://notes/1',
                    mimeType: 'text/plain',
                    text: 'Report body',
                  },
                },
                {
                  type: 'resource',
                  resource: {
                    uri: 'mcp://files/archive',
                    mimeType: 'application/zip',
                    blob: 'YmluYXJ5',
                  },
                },
                {
                  type: 'resource_link',
                  uri: 'mcp://catalog/2',
                  name: 'Catalog',
                  description: 'Current catalog',
                  mimeType: 'text/plain',
                  size: 42,
                },
              ],
            },
          },
        }),
      );
    });

    expect(mocks.submit).toHaveBeenCalledWith(
      {
        input: {
          input: expect.stringContaining('Describe these'),
          files: [
            expect.objectContaining({
              name: 'mcp-app-image-2',
              mimeType: 'image/png',
              fileUrl: 'data:image/png;base64,aW1hZ2U=',
            }),
            expect.objectContaining({
              name: 'mcp-app-audio-3',
              mimeType: 'audio/wav',
              fileUrl: 'data:audio/wav;base64,YXVkaW8=',
            }),
            expect.objectContaining({
              name: 'mcp-app-resource-5',
              mimeType: 'application/zip',
              fileUrl: 'data:application/zip;base64,YmluYXJ5',
            }),
          ],
        },
      },
      expect.objectContaining({
        context: expect.objectContaining({
          mcpApp: expect.objectContaining({ appInstanceId: 'app-1' }),
        }),
      }),
    );
    const submittedInput = mocks.submit.mock.calls[0]?.[0]?.input?.input;
    expect(submittedInput).toContain('Report body');
    expect(submittedInput).toContain('mcp://files/archive');
    expect(submittedInput).toContain('mcp://catalog/2');
  });

  it('opens external links only after the audited host RPC accepts them', async () => {
    mocks.rpc.mockResolvedValueOnce({
      jsonrpc: '2.0',
      id: 'link-1',
      result: {},
    });
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<McpAppMessage data={data} messageId="message-1" />);
    const iframe = asIframe(await screen.findByTitle('Example App'));

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframe.contentWindow,
          data: {
            jsonrpc: '2.0',
            id: 'link-1',
            method: 'ui/open-link',
            params: { href: 'https://docs.example.com/report' },
          },
        }),
      );
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({
        method: 'ui/open-link',
        params: { url: 'https://docs.example.com/report' },
      }),
      expect.objectContaining({ token: expect.any(String) }),
    );
    expect(open).toHaveBeenCalledWith(
      'https://docs.example.com/report',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('filters injected CSP directives from remote domain declarations', async () => {
    render(
      <McpAppMessage
        data={{
          ...data,
          csp: {
            connectDomains: [
              'https://api.example',
              'https://evil.example;form-action *',
            ],
          },
        }}
        messageId="message-1"
      />,
    );

    const iframe = asIframe(await screen.findByTitle('Example App'));
    expect(iframe.srcdoc).toContain('connect-src https://api.example');
    expect(iframe.srcdoc).toContain('form-action https://api.example');
    expect(iframe.srcdoc).not.toContain('form-action *');
    expect(iframe.srcdoc).toContain("object-src 'none'");
  });

  it('uses an approved dedicated sandbox origin through the proxy handshake', async () => {
    mocks.getResource.mockResolvedValueOnce({
      uri: data.resourceUri,
      text: '<!doctype html><html><body>Dedicated App</body></html>',
      domain: 'weather.mcp-apps.example.com',
      permissions: { clipboardWrite: {} },
      toolInput: {},
      toolInfo: {
        name: data.toolName,
        inputSchema: { type: 'object', properties: {} },
      },
    });

    render(
      <McpAppMessage
        data={data}
        messageId="message-1"
        mcpApps={{
          sandboxProxyUrl:
            'https://sandbox.mcp-apps.example.com/mcp-app-sandbox-proxy.html',
          allowedDomains: ['*.mcp-apps.example.com'],
        }}
      />,
    );

    const iframe = asIframe(await screen.findByTitle('Example App'));
    expect(iframe.src).toContain(
      'https://weather.mcp-apps.example.com/mcp-app-sandbox-proxy.html',
    );
    expect(iframe.srcdoc).toBe('');
    expect(iframe.getAttribute('sandbox')).toBe(
      'allow-scripts allow-same-origin',
    );

    const iframeWindow = getIframeWindow(iframe);
    const postMessage = vi.spyOn(iframeWindow, 'postMessage');
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframeWindow,
          origin: 'https://weather.mcp-apps.example.com',
          data: {
            jsonrpc: '2.0',
            method: 'ui/notifications/sandbox-proxy-ready',
            params: {},
          },
        }),
      );
    });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'ui/notifications/sandbox-resource-ready',
        params: expect.objectContaining({
          html: expect.stringContaining('Dedicated App'),
          sandbox: 'allow-forms allow-modals allow-scripts allow-same-origin',
          permissions: { clipboardWrite: {} },
        }),
      }),
      'https://weather.mcp-apps.example.com',
    );
  });

  it('downloads files only after the user approves the exact request', async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        jsonrpc: '2.0',
        id: 'download-1',
        error: {
          code: -32001,
          message: 'Approval required',
          data: {
            approvalId: 'approval-download',
            risk: 'write',
            expiresAt: Date.now() + 60_000,
          },
        },
      })
      .mockResolvedValueOnce({
        jsonrpc: '2.0',
        id: 'download-1',
        result: {},
      });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:https://chat.example/download-1'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });

    render(<McpAppMessage data={data} messageId="message-1" />);
    const iframe = asIframe(await screen.findByTitle('Example App'));
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframe.contentWindow,
          data: {
            jsonrpc: '2.0',
            id: 'download-1',
            method: 'ui/download-file',
            params: {
              contents: [
                {
                  type: 'resource',
                  resource: {
                    uri: 'ui://reports/monthly.csv',
                    mimeType: 'text/csv',
                    text: 'month,value\nAugust,42',
                  },
                },
              ],
            },
          },
        }),
      );
    });

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(click).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Allow' }));

    await waitFor(() => {
      expect(mocks.approve).toHaveBeenCalledWith(
        'app-1',
        'approval-download',
        expect.objectContaining({ token: 'runtime-token' }),
      );
      expect(click).toHaveBeenCalledOnce();
    });
  });

  it('rejects a pending action without retrying the tool call', async () => {
    mocks.rpc.mockResolvedValueOnce({
      jsonrpc: '2.0',
      id: 'rpc-reject',
      error: {
        code: -32001,
        message: 'Approval required',
        data: {
          approvalId: 'approval-reject',
          risk: 'destructive',
          expiresAt: Date.now() + 60_000,
        },
      },
    });

    render(<McpAppMessage data={data} messageId="message-1" />);
    const iframe = asIframe(await screen.findByTitle('Example App'));
    const postMessage = vi.spyOn(getIframeWindow(iframe), 'postMessage');
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframe.contentWindow,
          data: {
            jsonrpc: '2.0',
            id: 'rpc-reject',
            method: 'tools/call',
            params: {
              name: 'delete_record',
              arguments: { id: 'record-1' },
            },
          },
        }),
      );
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));

    await waitFor(() => {
      expect(mocks.reject).toHaveBeenCalledWith(
        'app-1',
        'approval-reject',
        expect.objectContaining({ token: 'runtime-token' }),
      );
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'rpc-reject',
        error: expect.objectContaining({ code: -32002 }),
      }),
      '*',
    );
  });

  it('tears down the server-side App instance after unmount', async () => {
    const rendered = render(
      <McpAppMessage data={data} messageId="message-1" />,
    );
    const iframe = asIframe(await screen.findByTitle('Example App'));
    const postMessage = vi.spyOn(getIframeWindow(iframe), 'postMessage');

    rendered.unmount();

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'ui/resource-teardown',
          params: { reason: 'host-unmount' },
        }),
        '*',
      );
      expect(mocks.teardown).toHaveBeenCalledWith(
        'app-1',
        expect.objectContaining({ token: 'runtime-token' }),
      );
    });
  });

  it('honors app-initiated teardown after notifying the view', async () => {
    render(<McpAppMessage data={data} messageId="message-1" />);
    const iframe = asIframe(await screen.findByTitle('Example App'));
    const iframeWindow = getIframeWindow(iframe);
    const postMessage = vi.spyOn(iframeWindow, 'postMessage');

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframeWindow,
          data: {
            jsonrpc: '2.0',
            method: 'ui/notifications/request-teardown',
            params: {},
          },
        }),
      );
    });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'ui/resource-teardown',
        params: { reason: 'app-requested' },
      }),
      '*',
    );
    expect(mocks.teardown).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({ token: 'runtime-token' }),
    );
    expect(screen.queryByTitle('Example App')).not.toBeInTheDocument();
  });
});

describe('resolveMcpAppSandboxProxy', () => {
  const hostLocation = 'https://chat.example.com/thread/1';

  it('fails closed for same-origin or non-http sandbox URLs', () => {
    expect(
      resolveMcpAppSandboxProxy(
        { sandboxProxyUrl: '/mcp-app-sandbox-proxy.html' },
        undefined,
        hostLocation,
      ),
    ).toBeNull();
    expect(
      resolveMcpAppSandboxProxy(
        { sandboxProxyUrl: 'javascript:alert(1)' },
        undefined,
        hostLocation,
      ),
    ).toBeNull();
  });

  it('uses server domains only when the host allowlists them', () => {
    const options = {
      sandboxProxyUrl:
        'https://sandbox.mcp-apps.example.com/mcp-app-sandbox-proxy.html',
      allowedDomains: ['*.mcp-apps.example.com'],
    };
    const approved = resolveMcpAppSandboxProxy(
      options,
      'weather.mcp-apps.example.com',
      hostLocation,
    );
    expect(approved).toMatchObject({
      origin: 'https://weather.mcp-apps.example.com',
      dedicatedOrigin: true,
    });
    expect(approved?.url).toContain(
      'parentOrigin=https%3A%2F%2Fchat.example.com',
    );

    const unapproved = resolveMcpAppSandboxProxy(
      options,
      'attacker.example.net',
      hostLocation,
    );
    expect(unapproved).toMatchObject({
      origin: 'https://sandbox.mcp-apps.example.com',
      dedicatedOrigin: false,
    });
  });
});
