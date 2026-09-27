import * as React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ChatKitOptions,
  ChatKitWorkbenchClientCommandRequest,
} from '@xpert-ai/chatkit-types';
import {
  StreamProvider,
  useStreamContext,
  type StreamContextType,
} from '../providers/Stream';
import { ThemeProvider } from '../providers/Theme';
import { WorkbenchPanel, SIDE_CHAT_VIEW_KEY } from './WorkbenchPanel';
import { useWorkbenchNavigation } from './useWorkbenchNavigation';

const mocks = vi.hoisted(() => ({
  isParentAvailable: true,
  sendCommand: vi.fn(),
  sendEvent: vi.fn(),
  clearActivities: vi.fn(),
  refreshServices: vi.fn(),
}));
vi.mock('../hooks/useParentMessenger', () => ({
  useParentMessenger: () => ({
    isParentAvailable: mocks.isParentAvailable,
    sendCommand: mocks.sendCommand,
    sendEvent: mocks.sendEvent,
  }),
}));
vi.mock('nuqs', async () => {
  const react = await import('react');
  return { useQueryState: () => react.useState(null) };
});
vi.mock('@xpert-ai/xpert-sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xpert-ai/xpert-sdk')>()),
  Client: class {
    threads = {
      get: async () => ({ metadata: { id: 'conversation' }, status: 'idle' }),
    };
    conversations = {
      get: async () => ({ id: 'conversation', status: 'idle' }),
      searchMessages: async () => ({ items: [], total: 0 }),
    };
    runs = { list: async () => [] };
  },
}));
vi.mock('../providers/runtime-activities', () => ({
  logRuntimeActivity: vi.fn(),
  useRuntimeActivities: () => ({
    runtimeActivities: {},
    clearRuntimeActivities: mocks.clearActivities,
    refreshSandboxServices: mocks.refreshServices,
    handleRuntimeActivityTrigger: mocks.clearActivities,
    stopRuntimeActivityItem: mocks.clearActivities,
  }),
}));
vi.mock('../components/chat', () => ({
  Chat: () => {
    side = useStreamContext();
    return null;
  },
}));
vi.mock('./RemoteViewFrame', () => ({ RemoteViewFrame: () => null }));
vi.mock('./ExternalAssistantView', () => ({
  ExternalAssistantView: () => null,
}));

let main: StreamContextType;
let side: StreamContextType;
let navigation: ReturnType<typeof useWorkbenchNavigation>;
const request: ChatKitWorkbenchClientCommandRequest = {
  commandKey: 'workbench.navigation.open',
  payload: {
    target: 'assistant.conversation',
    conversationId: 'conversation-B',
  },
  hostType: 'agent',
  hostId: 'assistant-A',
  viewKey: 'tasks',
};
const session = {
  assistantId: 'assistant-B',
  projectId: 'project-B',
  threadId: 'thread-B',
  conversationId: 'conversation-B',
  secret: 'cs-x-expired-B',
  organizationId: 'org',
};
const options: ChatKitOptions = {
  api: {
    apiUrl: 'https://api.example.test/api/ai',
    xpertId: 'assistant-A',
    getClientSecret: async () => 'cs-x-A',
  },
};
const noop = () => {};

function Panel() {
  main = useStreamContext();
  return (
    <WorkbenchPanel
      stream={main}
      options={options}
      hostId={main.assistantId}
      runtimeScope={{
        projectId: main.projectId ?? null,
        conversationId: main.conversationId ?? null,
      }}
      locale="en-US"
      visible
      previews={[]}
      viewQueries={{}}
      views={[]}
      activeView={null}
      activeViewKey={SIDE_CHAT_VIEW_KEY}
      sideChat={{
        sourceThreadId: 'thread-B',
        threadId: 'side-thread-B',
        title: 'Side chat',
        referenceRequest: {
          id: 'quote',
          reference: { type: 'quote', text: 'Selected text' },
        },
      }}
      sideChatOpening={false}
      externalViewOpen={false}
      externalRuns={[]}
      workbenchMessages={[]}
      selectedExternalId={null}
      hostEvent={null}
      viewHosts={main.client.viewHosts}
      notification={null}
      error={null}
      loading={false}
      expanded={false}
      onClosePreview={noop}
      onSelectExternal={noop}
      onCloseExternal={noop}
      onClose={noop}
      onRequestCloseSideChat={noop}
      onToggleExpanded={noop}
      onReload={noop}
      onSelect={noop}
      onNotify={noop}
      onClientCommand={async () => undefined}
    />
  );
}

function NavigatedPanel({ settings }: { settings: ChatKitOptions }) {
  navigation = useWorkbenchNavigation(settings, 'org');
  if (!navigation.session) return null;
  return (
    <ThemeProvider>
      <StreamProvider
        apiUrl={settings.api.apiUrl}
        apiKey={navigation.session.secret}
        organizationId={navigation.session.organizationId}
        xpertId={navigation.session.assistantId}
        projectId={navigation.session.projectId ?? undefined}
        threadStateMode="memory"
        getClientSecret={navigation.refresh}
      >
        <Panel />
      </StreamProvider>
    </ThemeProvider>
  );
}

async function open(settings: ChatKitOptions) {
  render(<NavigatedPanel settings={settings} />);
  act(() => navigation.navigate(session, request));
  await waitFor(() => expect(navigation.session).toEqual(session));
  await waitFor(() => expect(side.historyLoad.status).toBe('loaded'));
}

describe('Side Chat credentials after Workbench navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isParentAvailable = true;
    mocks.sendCommand.mockReset().mockResolvedValue('cs-x-A');
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([true, false])(
    'shares scoped renewal for main and side chat (parent bridge: %s)',
    async (bridge) => {
      mocks.isParentAvailable = bridge;
      let renew!: (value: unknown) => void;
      const refresh = vi.fn(
        () =>
          new Promise((resolve) => {
            renew = resolve;
          }),
      );
      mocks.sendCommand.mockImplementation((command) =>
        command === 'onWorkbenchClientCommand' ? refresh() : 'cs-x-A',
      );
      const fetcher = vi.fn(
        async (_input: unknown, init?: RequestInit) =>
          new Response(null, {
            status:
              new Headers(init?.headers).get('x-api-key') === 'cs-x-renewed-B'
                ? 200
                : 401,
          }),
      );
      vi.stubGlobal('fetch', fetcher);
      await open(
        bridge
          ? options
          : { ...options, workbench: { onClientCommand: refresh } },
      );
      expect(side.assistantId).toBe('assistant-B');
      expect(side.threadId).toBe('side-thread-B');
      await act(async () => {
        const results = Promise.all([
          main.authenticatedFetch('https://api.example.test/main'),
          side.authenticatedFetch('https://api.example.test/side'),
        ]);
        await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
        renew({
          success: true,
          session: { ...session, secret: 'cs-x-renewed-B' },
        });
        expect((await results).map((response) => response.status)).toEqual([
          200, 200,
        ]);
      });
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(main.apiKey).toBe('cs-x-renewed-B');
      expect(side.apiKey).toBe('cs-x-renewed-B');
      expect(side.threadId).toBe('side-thread-B');
      expect(fetcher).toHaveBeenCalledTimes(4);
      const retryHeaders = fetcher.mock.calls
        .slice(2)
        .map(([, init]) => new Headers(init?.headers));
      expect(
        retryHeaders.map((headers) => headers.get('organization-id')),
      ).toEqual(['org', 'org']);
      expect(
        mocks.sendCommand.mock.calls.some(
          ([command]) => command === 'onGetClientSecret',
        ),
      ).toBe(false);
    },
  );

  it('keeps the failed response when renewal changes Assistant scope, without falling back to A', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetcher);
    vi.spyOn(console, 'warn').mockImplementation(noop);
    mocks.sendCommand.mockResolvedValue({
      success: true,
      session: { ...session, assistantId: 'assistant-C' },
    });
    await open(options);
    await act(async () => {
      expect(
        (await side.authenticatedFetch('https://api.example.test/side')).status,
      ).toBe(401);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(mocks.sendCommand).toHaveBeenCalledExactlyOnceWith(
      'onWorkbenchClientCommand',
      request,
    );
    expect(side.apiKey).toBe('cs-x-expired-B');
    expect(side.assistantId).toBe('assistant-B');
  });
});
