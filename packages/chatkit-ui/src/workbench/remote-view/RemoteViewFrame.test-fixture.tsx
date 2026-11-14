import { render } from '@testing-library/react';
import { vi } from 'vitest';
import type { ChatKitTheme } from '@xpert-ai/chatkit-types';
import type { XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
import { ThemeProvider } from '../../providers/Theme';
import { RemoteViewFrame } from './RemoteViewFrame';

export const mocks = {
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
      getLocalDraftBinding: vi.fn(),
      listSlotViews: vi.fn(),
      getManifest: vi.fn(),
      getRemoteComponentEntry: vi.fn(),
      getData: vi.fn(),
      getParameterOptions: vi.fn(),
      executeAction: vi.fn(),
      executeFileAction: vi.fn(),
      createFileAccessSession: vi.fn(),
      createFileAccessGrant: vi.fn(),
      readFileAccess: vi.fn(),
      revokeFileAccessSession: vi.fn(),
    },
  },
};

export const manifest: XpertExtensionViewManifest = {
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
  fileAccess: { purposes: ['preview', 'download'] },
};
export const runtimeScope = {
  projectId: 'project-1',
  conversationId: 'conversation-1',
};

export function renderFrame(theme?: ChatKitTheme, viewManifest = manifest) {
  return render(renderFrameElement(theme, runtimeScope, true, viewManifest));
}

export function renderFrameElement(
  theme?: ChatKitTheme,
  scope: {
    projectId: string | null;
    conversationId: string | null;
  } = runtimeScope,
  contextReady = true,
  viewManifest = manifest,
  visible = true,
) {
  return (
    <ThemeProvider theme={theme}>
      <RemoteViewFrame
        visible={visible}
        manifest={viewManifest}
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

export function dispatchFrameMessage(
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

export function isObject(value: unknown): value is object {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function getContentWindow(iframe: HTMLIFrameElement): Window {
  const contentWindow = iframe.contentWindow;
  if (!contentWindow) {
    throw new Error('Expected the iframe to expose a contentWindow.');
  }
  return contentWindow;
}
