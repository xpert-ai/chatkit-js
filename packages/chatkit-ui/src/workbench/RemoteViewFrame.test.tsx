import * as React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
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
const runtimeScope = {
  projectId: 'project-1',
  conversationId: 'conversation-1',
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

  it('sends updated navigation selection and parameters to a retained view', async () => {
    const props = {
      manifest,
      hostId: 'agent-1',
      locale: 'en-US',
      title: 'Documents',
      hostEvent: null,
      viewHosts: mocks.client.viewHosts,
      onNotify: vi.fn(),
      onClientCommand: vi.fn(),
    };
    const { rerender } = render(
      <RemoteViewFrame {...props} initialQuery={{ selectionId: 'first' }} />,
      { wrapper: ThemeProvider },
    );
    const iframe = await screen.findByTitle('Documents');
    const postMessage = vi.spyOn(
      getContentWindow(iframe as HTMLIFrameElement),
      'postMessage',
    );
    fireEvent.load(iframe);
    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'init',
        initialQuery: { page: 1, pageSize: 20, selectionId: 'first' },
      }),
      '*',
    );
    rerender(
      <RemoteViewFrame
        {...props}
        initialQuery={{ selectionId: 'second', parameters: { tab: 'review' } }}
      />,
    );
    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'init',
        initialQuery: {
          page: 1,
          pageSize: 20,
          selectionId: 'second',
          parameters: { tab: 'review' },
        },
      }),
      '*',
    );
    expect(screen.getByTitle('Documents')).toBe(iframe);
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

  it('checks frame identity and declared commands before dispatching local navigation', async () => {
    const navigationManifest: XpertExtensionViewManifest = {
      ...manifest,
      clientCommands: [
        {
          key: 'workbench.navigation.open',
          label: { en_US: 'Open execution' },
        },
      ],
    };
    const onClientCommand = vi
      .fn()
      .mockResolvedValue({ success: true, status: 'opened' });
    render(
      <ThemeProvider>
        <RemoteViewFrame
          manifest={navigationManifest}
          hostId="agent-1"
          locale="en-US"
          title="Documents"
          hostEvent={null}
          viewHosts={mocks.client.viewHosts}
          onNotify={vi.fn()}
          onClientCommand={onClientCommand}
        />
      </ThemeProvider>,
    );
    const iframe = (await screen.findByTitle('Documents')) as HTMLIFrameElement;
    const postMessage = vi.spyOn(getContentWindow(iframe), 'postMessage');
    fireEvent.load(iframe);
    const init = postMessage.mock.calls.find(
      ([message]) =>
        isObject(message) && Reflect.get(message, 'type') === 'init',
    )?.[0];
    const instanceId = isObject(init)
      ? Reflect.get(init, 'instanceId')
      : undefined;
    expect(instanceId).toBeTruthy();
    const command = {
      channel: REMOTE_COMPONENT_CHANNEL,
      protocolVersion: 1,
      instanceId,
      type: 'invokeClientCommand',
      requestId: 'open-execution',
      commandKey: 'workbench.navigation.open',
      payload: {
        target: 'assistant.execution',
        conversationId: 'conversation-1',
        executionId: 'attempt-2',
      },
    };
    window.dispatchEvent(new MessageEvent('message', { data: command }));
    dispatchFrameMessage(iframe, { ...command, instanceId: 'stale-instance' });
    expect(onClientCommand).not.toHaveBeenCalled();
    dispatchFrameMessage(iframe, {
      ...command,
      requestId: 'undeclared',
      commandKey: 'assistant.chat.send_message',
    });
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'undeclared',
          type: 'error',
        }),
        '*',
      ),
    );
    expect(onClientCommand).not.toHaveBeenCalled();
    dispatchFrameMessage(iframe, command);
    await waitFor(() =>
      expect(onClientCommand).toHaveBeenCalledExactlyOnceWith(
        'workbench.navigation.open',
        command.payload,
        navigationManifest,
      ),
    );
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'open-execution',
          type: 'clientCommandResult',
        }),
        '*',
      ),
    );
  });

  it('scopes entry, data and actions to the host conversation, ignoring iframe scope overrides', async () => {
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
    expect(mocks.client.viewHosts.getRemoteComponentEntry).toHaveBeenCalledWith(
      'agent',
      'agent-1',
      manifest.key,
      { signal: expect.any(AbortSignal), runtimeScope },
    );

    dispatchFrameMessage(iframe, {
      channel: REMOTE_COMPONENT_CHANNEL,
      protocolVersion: 1,
      instanceId,
      type: 'requestData',
      requestId: 'request-1',
      query: { page: 2 },
      runtimeScope: { conversationId: 'untrusted-conversation' },
    });
    await waitFor(() =>
      expect(mocks.client.viewHosts.getData).toHaveBeenCalledWith(
        'agent',
        'agent-1',
        manifest.key,
        { page: 2 },
        { signal: expect.any(AbortSignal), runtimeScope },
      ),
    );

    mocks.client.viewHosts.executeAction.mockResolvedValue({ success: true });
    dispatchFrameMessage(iframe, {
      channel: REMOTE_COMPONENT_CHANNEL,
      protocolVersion: 1,
      instanceId,
      type: 'executeAction',
      requestId: 'action-1',
      actionKey: 'approve',
      input: {},
      runtimeScope: { conversationId: 'untrusted-conversation' },
    });
    await waitFor(() =>
      expect(mocks.client.viewHosts.executeAction).toHaveBeenCalledWith(
        'agent',
        'agent-1',
        manifest.key,
        'approve',
        expect.any(Object),
        { signal: expect.any(AbortSignal), runtimeScope },
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
  it('keeps the iframe across conversation and project changes and broadcasts complete context without subscriptions', async () => {
    const initialScope = { projectId: null, conversationId: null };
    const { rerender } = render(renderFrameElement(undefined, initialScope));
    const iframe = (await screen.findByTitle('Documents')) as HTMLIFrameElement;
    const originalWindow = iframe.contentWindow;
    const post = vi.spyOn(getContentWindow(iframe), 'postMessage');
    fireEvent.load(iframe);
    expect(post).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'init',
        runtimeScope: initialScope,
        scopeRevision: 0,
      }),
      '*',
    );
    const instanceId = post.mock.calls.at(-1)![0].instanceId;
    for (const next of [
      { projectId: null, conversationId: 'conversation-2' },
      { projectId: 'project-2', conversationId: 'conversation-3' },
    ]) {
      post.mockClear();
      rerender(renderFrameElement(undefined, next));
      await waitFor(() =>
        expect(post).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'hostEvent',
            instanceId,
            event: expect.objectContaining({
              type: 'view.context.changed',
              data: {
                revision: expect.any(Number),
                runtimeScope: next,
              },
            }),
          }),
          '*',
        ),
      );
      expect(screen.getByTitle('Documents')).toBe(iframe);
      expect(iframe.contentWindow).toBe(originalWindow);
      expect(
        post.mock.calls.filter(([message]) => message.type === 'init'),
      ).toHaveLength(0);
    }
  });

  it('blocks unresolved contexts, aborts old reads and rejects explicitly stale requests', async () => {
    let finish!: (value: unknown) => void;
    mocks.client.viewHosts.getData.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { rerender } = renderFrame();
    const iframe = (await screen.findByTitle('Documents')) as HTMLIFrameElement;
    const post = vi.spyOn(getContentWindow(iframe), 'postMessage');
    fireEvent.load(iframe);
    const instanceId = post.mock.calls.at(-1)![0].instanceId;
    const request = {
      channel: REMOTE_COMPONENT_CHANNEL,
      protocolVersion: 1,
      instanceId,
      type: 'requestData',
      requestId: 'old-read',
      scopeRevision: 0,
    };
    act(() => dispatchFrameMessage(iframe, request));
    await waitFor(() =>
      expect(mocks.client.viewHosts.getData).toHaveBeenCalledOnce(),
    );
    const signal = mocks.client.viewHosts.getData.mock.calls[0][4].signal;
    post.mockClear();
    rerender(renderFrameElement(undefined, runtimeScope, false));
    expect(signal.aborted).toBe(true);
    expect(screen.getByTitle('Documents')).toBe(iframe);
    expect(iframe).toHaveAttribute('inert');
    await act(async () => finish({ items: ['old'] }));
    expect(post.mock.calls.some(([message]) => message.type === 'data')).toBe(
      false,
    );
    expect(
      post.mock.calls.some(([message]) => message.type === 'hostEvent'),
    ).toBe(false);
    const target = { projectId: 'project-2', conversationId: 'conversation-2' };
    rerender(renderFrameElement(undefined, target));
    await waitFor(() => expect(iframe).not.toHaveAttribute('inert'));
    act(() =>
      dispatchFrameMessage(iframe, { ...request, requestId: 'stale-command' }),
    );
    expect(mocks.client.viewHosts.getData).toHaveBeenCalledOnce();
    const context = post.mock.calls.find(
      ([message]) => message.type === 'hostEvent',
    )![0].event.data;
    act(() =>
      dispatchFrameMessage(iframe, {
        ...request,
        requestId: 'new-read',
        scopeRevision: context.revision,
      }),
    );
    await waitFor(() =>
      expect(mocks.client.viewHosts.getData).toHaveBeenCalledTimes(2),
    );
    expect(
      mocks.client.viewHosts.getData.mock.calls[1][4].runtimeScope,
    ).toEqual(target);
  });

  it('removes the retained document when the target entry denies access', async () => {
    const { rerender } = renderFrame();
    const iframe = await screen.findByTitle('Documents');
    mocks.client.viewHosts.getRemoteComponentEntry.mockRejectedValueOnce(
      new Error('Forbidden'),
    );
    rerender(
      renderFrameElement(undefined, {
        projectId: 'forbidden',
        conversationId: null,
      }),
    );
    await screen.findByText('Forbidden');
    expect(iframe.isConnected).toBe(false);
  });
});

function renderFrame(theme?: ChatKitTheme) {
  return render(renderFrameElement(theme));
}

function renderFrameElement(
  theme?: ChatKitTheme,
  scope: {
    projectId: string | null;
    conversationId: string | null;
  } = runtimeScope,
  contextReady = true,
) {
  return (
    <ThemeProvider theme={theme}>
      <RemoteViewFrame
        manifest={manifest}
        hostId="agent-1"
        runtimeScope={scope}
        contextReady={contextReady}
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
