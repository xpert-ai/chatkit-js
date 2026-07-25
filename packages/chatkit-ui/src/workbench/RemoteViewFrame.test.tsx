import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatKitTheme } from '@xpert-ai/chatkit-types';
import type { XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
import { ThemeProvider } from '../providers/Theme';

const mocks = vi.hoisted(() => ({
  getRemoteComponentEntry: vi.fn(),
  getData: vi.fn(),
  getParameterOptions: vi.fn(),
  executeAction: vi.fn(),
  executeFileAction: vi.fn(),
  createFileAccessSession: vi.fn(),
  createFileAccessGrant: vi.fn(),
  revokeFileAccessSession: vi.fn(),
  client: {
    viewHosts: {
      listSlotViews: vi.fn(),
      getManifest: vi.fn(),
      getRemoteComponentEntry: vi.fn(),
      getData: vi.fn(),
      getParameterOptions: vi.fn(),
      executeAction: vi.fn(),
      executeFileAction: vi.fn(),
      createFileAccessSession: vi.fn(),
      createFileAccessGrant: vi.fn(),
      revokeFileAccessSession: vi.fn(),
    },
  },
}));

import { RemoteViewFrame } from './RemoteViewFrame';
import { REMOTE_COMPONENT_CHANNEL } from './protocol';

const manifest: XpertExtensionViewManifest = {
  key: 'provider__documents',
  title: { en_US: 'Documents' },
  hostType: 'agent',
  slot: 'agent.workbench.fixed',
  source: { provider: 'provider' },
  view: {
    type: 'remote_component',
    runtime: 'react',
    protocolVersion: 1,
    component: { isolation: 'iframe', entry: 'documents' },
    dataSource: { mode: 'platform' },
  },
  dataSource: {
    mode: 'platform',
    querySchema: { supportsPagination: true, defaultPageSize: 20 },
  },
  actions: [
    {
      key: 'approve',
      label: { en_US: 'Approve' },
      actionType: 'invoke',
      transport: 'json',
    },
  ],
  clientCommands: [
    { key: 'assistant.context.set', label: { en_US: 'Set context' } },
  ],
  fileAccess: { purposes: ['preview'] },
};

describe('RemoteViewFrame', () => {
  beforeEach(() => {
    for (const key of Object.keys(mocks.client.viewHosts)) {
      const method =
        mocks.client.viewHosts[key as keyof typeof mocks.client.viewHosts];
      method.mockReset();
    }
    mocks.client.viewHosts.getRemoteComponentEntry.mockResolvedValue(
      '<!doctype html><html><body><div id="root"></div></body></html>',
    );
    mocks.client.viewHosts.getData.mockResolvedValue({
      items: [{ id: 'doc-1' }],
    });
    mocks.client.viewHosts.revokeFileAccessSession.mockResolvedValue(undefined);
  });

  it('loads HTML with a credential-isolated iframe sandbox and sends init', async () => {
    renderFrame();
    const iframe = await screen.findByTitle('Documents');
    expect(iframe).toHaveAttribute(
      'sandbox',
      'allow-downloads allow-forms allow-modals allow-popups allow-scripts',
    );
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(iframe).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(iframe).toHaveAttribute('srcdoc');

    const postMessage = vi.spyOn(
      getContentWindow(iframe as HTMLIFrameElement),
      'postMessage',
    );
    fireEvent.load(iframe);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: REMOTE_COMPONENT_CHANNEL,
        protocolVersion: 1,
        type: 'init',
        manifest,
        initialQuery: { page: 1, pageSize: 20 },
      }),
      '*',
    );
  });

  it('forwards options.theme tokens and resends init after the theme changes', async () => {
    const lightTheme: ChatKitTheme = {
      colorScheme: 'light',
      color: {
        accent: { primary: '#2563eb', level: 2 },
        surface: {
          background: '#fef3c7',
          foreground: '#111827',
        },
      },
    };
    const darkTheme: ChatKitTheme = {
      colorScheme: 'dark',
      color: {
        accent: { primary: '#60a5fa', level: 2 },
        surface: {
          background: '#111827',
          foreground: '#f9fafb',
        },
      },
    };
    const view = renderFrame(lightTheme);
    const iframe = (await screen.findByTitle('Documents')) as HTMLIFrameElement;
    const postMessage = vi.spyOn(getContentWindow(iframe), 'postMessage');

    fireEvent.load(iframe);
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'init',
          theme: expect.objectContaining({
            mode: 'light',
            tokens: expect.objectContaining({
              colorBackground: '#fef3c7',
              colorPrimary: '#2563eb',
            }),
          }),
        }),
        '*',
      ),
    );

    postMessage.mockClear();
    view.rerender(renderFrameElement(darkTheme));
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'init',
          theme: expect.objectContaining({
            mode: 'dark',
            tokens: expect.objectContaining({
              colorBackground: '#111827',
              colorPrimary: '#60a5fa',
            }),
          }),
        }),
        '*',
      ),
    );
  });

  it('accepts requests only from the active iframe and correlates responses', async () => {
    renderFrame();
    const iframe = (await screen.findByTitle('Documents')) as HTMLIFrameElement;
    const postMessage = vi.spyOn(getContentWindow(iframe), 'postMessage');
    fireEvent.load(iframe);
    const initMessage = postMessage.mock.calls.find(
      ([message]) =>
        isObject(message) && Reflect.get(message, 'type') === 'init',
    )?.[0];
    const instanceId =
      isObject(initMessage) &&
      typeof Reflect.get(initMessage, 'instanceId') === 'string'
        ? String(Reflect.get(initMessage, 'instanceId'))
        : '';
    expect(instanceId).toBeTruthy();

    dispatchFrameMessage(iframe, {
      channel: REMOTE_COMPONENT_CHANNEL,
      protocolVersion: 1,
      instanceId,
      type: 'requestData',
      requestId: 'request-1',
      query: { page: 2 },
    });
    await waitFor(() =>
      expect(mocks.client.viewHosts.getData).toHaveBeenCalledWith(
        'agent',
        'agent-1',
        manifest.key,
        { page: 2 },
        { signal: expect.any(AbortSignal) },
      ),
    );
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'data',
          requestId: 'request-1',
          data: { items: [{ id: 'doc-1' }] },
        }),
        '*',
      ),
    );

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          channel: REMOTE_COMPONENT_CHANNEL,
          protocolVersion: 1,
          instanceId,
          type: 'requestData',
          requestId: 'wrong-source',
        },
      }),
    );
    expect(mocks.client.viewHosts.getData).toHaveBeenCalledTimes(1);
  });
});

function renderFrame(theme?: ChatKitTheme) {
  return render(renderFrameElement(theme));
}

function renderFrameElement(theme?: ChatKitTheme) {
  return (
    <ThemeProvider theme={theme}>
      <RemoteViewFrame
        manifest={manifest}
        hostId="agent-1"
        locale="en-US"
        title="Documents"
        hostEvent={null}
        viewHosts={mocks.client.viewHosts}
        onNotify={vi.fn()}
        onClientCommand={vi.fn()}
      />
    </ThemeProvider>
  );
}

function dispatchFrameMessage(
  iframe: HTMLIFrameElement,
  data: Record<string, unknown>,
) {
  const event = new MessageEvent('message', { data });
  Object.defineProperty(event, 'source', {
    configurable: true,
    value: iframe.contentWindow,
  });
  window.dispatchEvent(event);
}

function isObject(value: unknown): value is object {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getContentWindow(iframe: HTMLIFrameElement): Window {
  const contentWindow = iframe.contentWindow;
  if (!contentWindow) {
    throw new Error('Expected the iframe to expose a contentWindow.');
  }
  return contentWindow;
}
