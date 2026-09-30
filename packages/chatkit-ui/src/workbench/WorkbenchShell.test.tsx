import { CHATKIT_INTERNAL_PARENT_EVENT } from './host-events';
import * as React from 'react';
import {
  act,
  fireEvent,
  render as renderUI,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import type { XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
import type { StateType } from '../providers/Stream';

const mocks = vi.hoisted(() => ({
  listSlotViews: vi.fn(),
  submit: vi.fn(),
  copyThread: vi.fn(),
  deleteThread: vi.fn(),
  sideChatProps: null as null | {
    referenceRequest?: { reference?: { text?: string } };
  },
  sideChatMounts: 0,
  sideChatUnmounts: 0,
  remoteUnmounts: 0,
  resizeCallback: null as ResizeObserverCallback | null,
  remoteViewProps: null as {
    onClientCommand: (
      commandKey: string,
      payload: unknown,
      manifest: XpertExtensionViewManifest,
    ) => Promise<unknown>;
  } | null,
  stream: {
    client: {
      viewHosts: {
        listSlotViews: vi.fn(),
        getManifest: vi.fn(),
        getData: vi.fn(),
        getRemoteComponentEntry: vi.fn(),
        getParameterOptions: vi.fn(),
        executeAction: vi.fn(),
        executeFileAction: vi.fn(),
        createFileAccessSession: vi.fn(),
        createFileAccessGrant: vi.fn(),
        revokeFileAccessSession: vi.fn(),
      },
      threads: {
        copy: vi.fn(),
        delete: vi.fn(),
      },
      workbench: { listFiles: vi.fn() },
    },
    apiKey: 'cs-x-secret',
    apiUrl: '/api/ai',
    authenticatedFetch: vi.fn(),
    assistantId: 'agent-1',
    projectId: 'project-1',
    organizationId: 'organization-1',
    threadId: 'thread-1',
    conversationId: 'conversation-1',
    isLoading: false,
    messages: [] as StateType['messages'],
    submit: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock('../providers/Stream', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../providers/Stream')>()),
  useStreamContext: () => mocks.stream,
  StreamProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../components/chat', () => ({
  Chat: (props: { referenceRequest?: { reference?: { text?: string } } }) => {
    React.useEffect(() => {
      mocks.sideChatMounts += 1;
      return () => {
        mocks.sideChatUnmounts += 1;
      };
    }, []);
    mocks.sideChatProps = props;
    return <div data-testid="side-chat" />;
  },
}));

vi.mock('../hooks/useParentMessenger', () => ({
  useParentMessenger: () => ({
    isParentAvailable: false,
    sendCommand: vi.fn(),
  }),
}));

vi.mock('./native/WorkbenchTerminal', () => ({
  default: () => <div data-testid="terminal">Terminal content</div>,
}));

vi.mock('./RemoteViewFrame', () => ({
  RemoteViewFrame: (props: {
    title: string;
    onClientCommand: (
      commandKey: string,
      payload: unknown,
      manifest: XpertExtensionViewManifest,
    ) => Promise<unknown>;
  }) => {
    React.useEffect(
      () => () => {
        mocks.remoteUnmounts += 1;
      },
      [],
    );
    mocks.remoteViewProps = props;
    return <div data-testid="remote-view">{props.title}</div>;
  },
}));

import {
  WorkbenchShell,
  WorkbenchToggleButton,
  useWorkbench,
} from './WorkbenchShell';
import { SIDE_CHAT_CLOSE_CONFIRMATION_STORAGE_KEY } from './SideChatCloseDialog';
import { workbenchLayoutKey, writeWorkbenchLayout } from './layout-storage';
import { AssistantMessage } from '../components/thread/messages/ai';
import { toWorkbenchMessages } from './external-assistant-runs';
import { ThemeProvider } from '../providers/Theme';

const render = (ui: React.ReactElement) =>
  renderUI(ui, { wrapper: ThemeProvider });

function ExternalTranscript() {
  return (
    <>
      {toWorkbenchMessages(mocks.stream.messages).map((message) => (
        <AssistantMessage
          key={message.id}
          message={{ ...message, type: 'assistant' }}
        />
      ))}
    </>
  );
}

function externalMessages(text = 'External response'): StateType['messages'] {
  return [
    {
      id: 'message-1',
      type: 'ai',
      executionId: 'root',
      content: [
        { type: 'text', text: 'Main response' },
        {
          type: 'text',
          text,
          executionId: 'external-1',
          parentExecutionId: 'root',
        },
        {
          type: 'text',
          text: 'Unchanged sub-agent output',
          executionId: 'sub-1',
          parentExecutionId: 'root',
        },
      ],
      agentRuns: [
        {
          id: 'external-1',
          parentId: 'root',
          invocationKind: 'external_assistant',
          title: 'External review',
          model: 'model-review',
          status: 'running',
        },
        {
          id: 'sub-1',
          parentId: 'root',
          invocationKind: 'sub_agent',
          title: 'Internal reviewer',
          status: 'running',
        },
      ],
    },
  ];
}

const manifest: XpertExtensionViewManifest = {
  key: 'provider__documents',
  title: { en_US: 'Documents', zh_Hans: '文档' },
  hostType: 'agent',
  slot: 'agent.workbench.fixed',
  order: 10,
  source: { provider: 'provider' },
  workbench: { openMode: 'auto', menu: { enabled: true, order: 10 } },
  view: {
    type: 'remote_component',
    runtime: 'react',
    protocolVersion: 1,
    component: {
      isolation: 'iframe',
      entry: 'documents',
    },
    dataSource: { mode: 'platform' },
  },
  dataSource: { mode: 'platform' },
};

const baseOptions = {
  api: {
    apiUrl: '/api/ai',
    xpertId: 'agent-1',
    getClientSecret: async () => 'secret',
  },
} satisfies ChatKitOptions;

class ResizeObserverMock {
  constructor(private callback: ResizeObserverCallback) {}
  observe(element: Element) {
    if (element.hasAttribute('data-chatkit-workbench-root')) {
      mocks.resizeCallback = this.callback;
    }
  }
  disconnect() {}
  unobserve() {}
}

describe('WorkbenchShell', () => {
  beforeEach(() => {
    mocks.listSlotViews.mockReset();
    mocks.submit.mockReset();
    mocks.copyThread.mockReset();
    mocks.deleteThread.mockReset();
    mocks.stream.client.viewHosts.listSlotViews = mocks.listSlotViews;
    mocks.stream.client.threads.copy = mocks.copyThread;
    mocks.stream.client.threads.delete = mocks.deleteThread;
    mocks.stream.submit = mocks.submit;
    mocks.resizeCallback = null;
    mocks.remoteViewProps = null;
    mocks.sideChatProps = null;
    mocks.sideChatMounts = 0;
    mocks.sideChatUnmounts = 0;
    mocks.remoteUnmounts = 0;
    mocks.stream.reset.mockReset();
    mocks.stream.client.workbench.listFiles.mockReset().mockResolvedValue([]);
    mocks.stream.isLoading = false;
    mocks.stream.apiKey = 'cs-x-secret';
    mocks.stream.apiUrl = '/api/ai';
    mocks.stream.assistantId = 'agent-1';
    mocks.stream.projectId = 'project-1';
    mocks.stream.organizationId = 'organization-1';
    mocks.stream.messages = [];
    mocks.stream.threadId = 'thread-1';
    mocks.stream.conversationId = 'conversation-1';
    window.localStorage.clear();
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  it('opens side chat from the guide without requiring a message reference', async () => {
    mocks.listSlotViews.mockResolvedValue([]);
    mocks.copyThread.mockResolvedValue({ thread_id: 'side-thread' });
    render(<WorkbenchShell options={{ ...baseOptions, workbench: { enabled: true } }} locale="en-US" onRequestContextChange={vi.fn()}>
      <WorkbenchToggleButton />
      <input aria-label="Draft" defaultValue="Keep my draft" />
    </WorkbenchShell>);
    setObservedWidth(1200);
    await waitFor(() => expect(screen.getByLabelText('Open views')).toBeEnabled());
    fireEvent.click(screen.getByLabelText('Open views'));
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    fireEvent.click(screen.getByRole('button', { name: 'Side chat' }));
    await screen.findByTestId('side-chat');
    expect(mocks.copyThread).toHaveBeenCalledWith('thread-1');
    expect(mocks.sideChatProps?.referenceRequest).toBeUndefined();
    expect(screen.getByLabelText('Draft')).toHaveValue('Keep my draft');
    expect(screen.queryByRole('tab', { name: 'New tab' })).not.toBeInTheDocument();
  });

  it.each([
    ['Files / folders', 'Open file'],
    ['Terminal', 'Terminal'],
  ])(
    'replaces a middle guide tab with %s and reuses it in place',
    async (tool, label) => {
      mocks.listSlotViews.mockResolvedValue([manifest]);
      render(
        <WorkbenchShell
          options={{ ...baseOptions, workbench: { enabled: true } }}
          locale="en-US"
          onRequestContextChange={vi.fn()}
        >
          <WorkbenchToggleButton />
        </WorkbenchShell>,
      );
      setObservedWidth(1200);
      await waitFor(() =>
        expect(screen.getByLabelText('Open views')).toBeEnabled(),
      );
      fireEvent.click(screen.getByLabelText('Open views'));
      fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
      const middle = screen.getByRole('tab', { name: 'New tab' });
      fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
      const last = screen.getAllByRole('tab', { name: 'New tab' })[1];
      fireEvent.click(middle);
      fireEvent.click(screen.getByRole('button', { name: tool }));
      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
        'Documents',
        label,
        'New tab',
      ]);
      expect(screen.getByRole('tab', { name: label })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(middle).not.toBeInTheDocument();
      expect(last).toBeInTheDocument();
      if (tool === 'Terminal') await screen.findByTestId('terminal');
      const toolPanel = screen.getByRole('tabpanel', { name: label });
      fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
      fireEvent.click(screen.getByRole('button', { name: tool }));
      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
        'Documents',
        'New tab',
        label,
      ]);
      expect(screen.getByRole('tabpanel', { name: label })).toBe(toolPanel);
      fireEvent.click(screen.getByRole('button', { name: `Close ${label}` }));
      expect(last).toHaveAttribute('aria-selected', 'true');
      expect(mocks.remoteUnmounts).toBe(0);
    },
  );

  it.each(['resolve', 'reject'] as const)(
    'replaces a guide with pending side chat in place and handles %s',
    async (result) => {
      mocks.listSlotViews.mockResolvedValue([manifest]);
      let resolve!: (value: { thread_id: string }) => void;
      let reject!: (error: Error) => void;
      mocks.copyThread.mockReturnValue(
        new Promise((done, fail) => {
          resolve = done;
          reject = fail;
        }),
      );
      render(
        <WorkbenchShell
          options={{ ...baseOptions, workbench: { enabled: true } }}
          locale="en-US"
          onRequestContextChange={vi.fn()}
        >
          <WorkbenchToggleButton />
        </WorkbenchShell>,
      );
      setObservedWidth(1200);
      await waitFor(() =>
        expect(screen.getByLabelText('Open views')).toBeEnabled(),
      );
      fireEvent.click(screen.getByLabelText('Open views'));
      fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
      const middle = screen.getByRole('tab', { name: 'New tab' });
      fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
      fireEvent.click(middle);
      fireEvent.click(screen.getByRole('button', { name: 'Side chat' }));
      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
        'Documents',
        'Side chat',
        'New tab',
      ]);
      await act(async () => {
        if (result === 'resolve') resolve({ thread_id: 'side-thread' });
        else reject(new Error('Side chat unavailable'));
      });
      const tabs = screen.getAllByRole('tab');
      expect(tabs.map((tab) => tab.textContent)).toEqual([
        'Documents',
        result === 'resolve' ? 'Side chat' : 'New tab',
        'New tab',
      ]);
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
      if (result === 'resolve')
        expect(screen.getByTestId('side-chat')).toBeVisible();
      else expect(screen.getByText('Side chat unavailable')).toBeVisible();
    },
  );

  it('creates independent guide tabs without reloading views or losing the draft', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    render(
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true } }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
        <input aria-label="Draft" defaultValue="Keep my message" />
      </WorkbenchShell>,
    );
    setObservedWidth(1200);
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    const source = await screen.findByTestId('remote-view');
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    const first = screen.getByRole('tab', { name: 'New tab' });
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(source).not.toBeVisible();
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'first query' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    expect(screen.getAllByRole('tab', { name: 'New tab' })).toHaveLength(2);
    expect(screen.getByRole('combobox')).toHaveValue('');
    fireEvent.click(first);
    expect(screen.getByRole('combobox')).toHaveValue('first query');
    expect(mocks.remoteUnmounts).toBe(0);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Close new tab' })[1],
    );
    expect(first).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Documents' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Close views: Documents' }),
    );
    expect(first).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Close new tab' })[0],
    );
    expect(screen.getByRole('tab', { name: 'New tab' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByLabelText('Draft')).toHaveValue('Keep my message');
    fireEvent.click(screen.getByRole('button', { name: 'Close new tab' }));
    expect(screen.getByLabelText('Open views')).toBeEnabled();
  });

  it('opens authorized tools and dynamic views from the guide and reuses existing tabs', async () => {
    mocks.listSlotViews.mockResolvedValue([
      manifest,
      {
        ...manifest,
        key: 'studio',
        title: 'Studio',
        workbench: { openMode: 'on-demand', menu: { enabled: true } },
      },
      { ...manifest, key: 'hidden', title: 'Hidden view', visible: false },
      {
        ...manifest,
        key: 'no-menu',
        title: 'No menu view',
        workbench: { openMode: 'on-demand', menu: { enabled: false } },
      },
    ]);
    render(
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true } }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
      </WorkbenchShell>,
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    const source = await screen.findByTestId('remote-view');
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    expect(
      screen.queryByRole('button', { name: 'Hidden view' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'No menu view' }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Recommended' })).getByRole(
        'button',
        { name: 'Studio' },
      ),
    );
    expect(screen.getByRole('tab', { name: 'Studio' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Documents',
      'Studio',
    ]);
    expect(
      screen.queryByRole('tab', { name: 'New tab' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    expect(
      within(screen.getByRole('region', { name: 'Recommended' })).queryByRole(
        'button',
        { name: 'Documents' },
      ),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Documents' }));
    expect(screen.getAllByRole('tab', { name: 'Documents' })).toHaveLength(1);
    expect(source).toBeVisible();
    expect(mocks.remoteUnmounts).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Close new tab' }));
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Documents' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Close views: Documents' }),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'New tab' }));
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Recommended' })).getByRole(
        'button',
        { name: 'Documents' },
      ),
    );
    expect(screen.getByRole('tab', { name: 'Documents' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Studio',
      'Documents',
    ]);
  });

  it('navigates websites in the same tab with back, forward, reload and home', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    render(
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true } }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
      </WorkbenchShell>,
    );
    await waitFor(() => expect(screen.getByLabelText('Open views')).toBeEnabled());
    fireEvent.click(screen.getByLabelText('Open views'));
    const source = await screen.findByTestId('remote-view');
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    const middle = screen.getByRole('tab', { name: 'New tab' });
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    fireEvent.click(middle);
    const navigate = (value: string) => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value } });
      fireEvent.submit(screen.getByRole('search'));
    };
    navigate('example.test/a.html');
    navigate('example.test/b.html');
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Documents', 'b.html', 'New tab']);
    const frame = within(screen.getByRole('region', { name: 'b.html' })).getByTitle('b.html');
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(frame).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'b.html' })).getByTitle('b.html')).toHaveAttribute('src', 'https://example.test/b.html');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('combobox')).toHaveValue('https://example.test/a.html');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Page options' }), { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Recent websites' }));
    fireEvent.click(await screen.findByRole('option', { name: /a.html/ }));
    expect(screen.getByRole('combobox')).toHaveValue('https://example.test/a.html');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Common tools' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }));
    expect(screen.getByRole('tab', { name: 'a.html' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Page options' }), { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Back to new tab' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Files / folders' }));
    });
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Documents', 'Open file', 'New tab']);
    expect(source).toBeInTheDocument();
    expect(mocks.remoteUnmounts).toBe(0);
  });

  it('retains website history when refreshing a guide with no remote views', async () => {
    mocks.listSlotViews.mockResolvedValue([]);
    render(
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true } }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
      </WorkbenchShell>,
    );
    await waitFor(() => expect(screen.getByLabelText('Open views')).toBeEnabled());
    fireEvent.click(screen.getByLabelText('Open views'));
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'example.test/a.html' } });
    fireEvent.submit(screen.getByRole('search'));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    });
    expect(screen.getByRole('button', { name: 'Forward' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /a.html Website/ })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }));
    expect(screen.getByRole('combobox')).toHaveValue('https://example.test/a.html');
  });

  it('keeps recent files after close, reopens their evidence and preserves other preview frames', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    render(
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true } }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
      </WorkbenchShell>,
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    await screen.findByTestId('remote-view');
    await act(async () => {
      await mocks.remoteViewProps?.onClientCommand(
        'workbench.file.open',
        {
          name: 'Report',
          url: 'https://example.org/report.pdf',
          evidence: { text: 'Source passage', locator: { page: 3 } },
        },
        manifest,
      );
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Close views: Report' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    fireEvent.click(screen.getByRole('button', { name: /Report File/ }));
    expect(screen.getByText('Source passage')).toBeVisible();
    expect(
      within(screen.getByRole('region', { name: 'Report' })).getByTitle(
        'Report',
      ),
    ).toHaveAttribute('src', 'https://example.org/report.pdf#page=3');
    const frame = within(
      screen.getByRole('region', { name: 'Report' }),
    ).getByTitle('Report');
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    const search = screen.getByRole('combobox');
    fireEvent.change(search, {
      target: { value: 'https://example.org/site.html' },
    });
    fireEvent.submit(screen.getByRole('search'));
    expect(screen.getByRole('tab', { name: 'site.html' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Documents',
      'Report',
      'site.html',
    ]);
    expect(frame).toBeInTheDocument();
    expect(frame).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    let recent = screen.getByRole('region', { name: 'Recently opened' });
    expect(within(recent).getAllByRole('button')[0]).toHaveTextContent(
      'site.html',
    );
    fireEvent.click(
      within(recent).getByRole('button', { name: /Report File/ }),
    );
    expect(screen.getAllByRole('tab', { name: 'Report' })).toHaveLength(1);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Documents',
      'site.html',
      'Report',
    ]);
    expect(
      within(screen.getByRole('region', { name: 'Report' })).getByTitle(
        'Report',
      ),
    ).toBe(frame);
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    recent = screen.getByRole('region', { name: 'Recently opened' });
    expect(within(recent).getAllByRole('button')).toHaveLength(2);
    expect(within(recent).getAllByRole('button')[0]).toHaveTextContent(
      'Report',
    );
  });

  it.each([
    'projectId',
    'conversationId',
    'organizationId',
    'assistantId',
  ] as const)(
    'clears new tabs and recent files when %s changes',
    async (field) => {
      mocks.listSlotViews.mockResolvedValue([manifest]);
      const onContext = vi.fn();
      const tree = () => (
        <WorkbenchShell
          options={{ ...baseOptions, workbench: { enabled: true } }}
          locale="en-US"
          onRequestContextChange={onContext}
        >
          <WorkbenchToggleButton />
        </WorkbenchShell>
      );
      const { rerender } = render(tree());
      await waitFor(() =>
        expect(screen.getByLabelText('Open views')).toBeEnabled(),
      );
      fireEvent.click(screen.getByLabelText('Open views'));
      await screen.findByTestId('remote-view');
      await act(async () => {
        await mocks.remoteViewProps?.onClientCommand(
          'workbench.file.open',
          { name: 'Private file', url: 'https://example.org/private.pdf' },
          manifest,
        );
      });
      fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
      expect(
        screen.getByRole('button', { name: /Private file File/ }),
      ).toBeVisible();
      mocks.stream[field] = 'new-scope';
      rerender(tree());
      await waitFor(() =>
        expect(
          screen.queryByRole('tab', { name: 'New tab' }),
        ).not.toBeInTheDocument(),
      );
      if (screen.queryByLabelText('Open views')) {
        await waitFor(() =>
          expect(screen.getByLabelText('Open views')).toBeEnabled(),
        );
        fireEvent.click(screen.getByLabelText('Open views'));
      }
      await screen.findByRole('tab', { name: 'Documents' });
      fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
      expect(
        screen.getByRole('region', { name: 'Recently opened' }),
      ).toHaveTextContent(
        'Files and websites opened in this conversation will appear here.',
      );
      expect(
        screen.queryByRole('tab', { name: 'Private file' }),
      ).not.toBeInTheDocument();
    },
  );

  it('opens on-demand views only on a scoped live request and allows close/reopen', async () => {
    const timeline = {
      ...manifest,
      key: 'platform.project-tasks__timeline',
      title: 'Tasks',
      workbench: { openMode: 'on-demand' as const, menu: { enabled: false } },
    };
    mocks.listSlotViews.mockResolvedValue([manifest, timeline]);
    render(
      <WorkbenchShell
        options={{
          ...baseOptions,
          workbench: { enabled: true, viewRail: { enabled: true } },
        }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
        <input aria-label="Draft" />
      </WorkbenchShell>,
    );
    await waitFor(() => expect(screen.getByLabelText('Open views')).toBeEnabled());
    fireEvent.click(screen.getByLabelText('Open views'));
    await screen.findByRole('tab', { name: 'Documents' });
    expect(
      screen.queryByRole('tab', { name: 'Tasks' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Tasks' }),
    ).not.toBeInTheDocument();
    const dispatch = (projectId: string, viewKey = timeline.key) =>
      act(() => {
        window.dispatchEvent(
          new CustomEvent(CHATKIT_INTERNAL_PARENT_EVENT, {
            detail: {
              event: 'public_event',
              data: [
                'log',
                {
                  name: 'lg.chat.event',
                  data: {
                    type: 'workbench.view.open',
                    projectId,
                    conversationId: 'conversation-1',
                    viewKey,
                  },
                },
              ],
            },
          }),
        );
      });
    dispatch('foreign');
    expect(
      screen.queryByRole('tab', { name: 'Tasks' }),
    ).not.toBeInTheDocument();
    dispatch('project-1', 'unavailable');
    expect(
      screen.queryByRole('tab', { name: 'Tasks' }),
    ).not.toBeInTheDocument();
    dispatch('project-1');
    await screen.findByRole('tab', { name: 'Tasks' });
    fireEvent.click(screen.getByRole('button', { name: 'Close views: Tasks' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('tab', { name: 'Tasks' }),
      ).not.toBeInTheDocument(),
    );
    dispatch('project-1');
    await screen.findByRole('tab', { name: 'Tasks' });
  });

  it('opens the selected on-demand view from the hover menu and preserves the draft and active view', async () => {
    const second = { ...manifest, key: 'second', title: 'Second view',
      workbench: { openMode: 'on-demand' as const, menu: { enabled: true } } };
    mocks.listSlotViews.mockResolvedValue([
      { ...manifest, key: 'hidden', title: 'Hidden view', visible: false },
      { ...manifest, key: 'no-menu', title: 'No menu view', workbench: { openMode: 'on-demand', menu: { enabled: false } } },
      second,
      { ...manifest, workbench: { openMode: 'on-demand', menu: { enabled: true } } },
    ]);
    render(
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true, viewRail: { enabled: true } } }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <header><WorkbenchToggleButton /></header>
        <input aria-label="Draft" defaultValue="Keep this message" />
      </WorkbenchShell>,
    );
    await waitFor(() => expect(screen.getByLabelText('Open views')).toBeEnabled());
    expect(screen.getAllByRole('button', { name: 'Open views' })).toHaveLength(1);
    expect(screen.queryByRole('navigation', { name: 'Available views' })).not.toBeInTheDocument();
    const trigger = screen.getByLabelText('Open views');
    expect(trigger).toHaveTextContent('2');
    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    const menu = await screen.findByRole('dialog', { name: 'Available views' });
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(within(menu).getAllByRole('button').map((button) => button.textContent)).toEqual(['Documents', 'Second view']);
    fireEvent.pointerLeave(trigger);
    fireEvent.pointerEnter(menu);
    await act(() => new Promise((resolve) => setTimeout(resolve, 200)));
    expect(menu).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Second view' }));
    expect(screen.getByRole('tab', { name: 'Second view' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Draft')).toHaveValue('Keep this message');
    fireEvent.click(screen.getByLabelText('Show or hide sidebar'));
    expect(screen.getByLabelText('Open views')).toBeEnabled();
    fireEvent.click(screen.getByLabelText('Open views'));
    expect(screen.getByRole('tab', { name: 'Second view' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Draft')).toHaveValue('Keep this message');
  });

  it('dismisses the hover menu and supports keyboard selection without opening a view on hover', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    render(
      <WorkbenchShell options={{ ...baseOptions, workbench: { enabled: true } }}
        locale="en-US" onRequestContextChange={vi.fn()}>
        <WorkbenchToggleButton />
      </WorkbenchShell>,
    );
    await waitFor(() => expect(screen.getByLabelText('Open views')).toBeEnabled());
    const trigger = screen.getByLabelText('Open views');
    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    const menu = await screen.findByRole('dialog', { name: 'Available views' });
    expect(screen.queryByTestId('remote-view')).not.toBeInTheDocument();
    fireEvent.pointerLeave(trigger);
    fireEvent.pointerLeave(menu);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const view = await screen.findByRole('button', { name: 'Documents' });
    await waitFor(() => expect(view).toHaveFocus());
    fireEvent.keyDown(view, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('button', { name: 'Documents' }));
    expect(await screen.findByRole('tab', { name: 'Documents' })).toHaveAttribute('aria-selected', 'true');
  });

  it.each([
    { enabled: true },
    { enabled: true, viewRail: { enabled: true } },
    { enabled: true, viewRail: { enabled: false } },
    { enabled: false, viewRail: { enabled: true } },
  ])(
    'uses the header entry without a rail, including legacy options: %j',
    async (workbench) => {
      mocks.listSlotViews.mockResolvedValue([manifest]);
      render(
        <WorkbenchShell
          options={{ ...baseOptions, workbench }}
          locale="en-US"
          onRequestContextChange={vi.fn()}
        >
          <WorkbenchToggleButton />
        </WorkbenchShell>,
      );
      if (workbench.enabled) {
        await waitFor(() =>
          expect(screen.getByLabelText('Open views')).toBeEnabled(),
        );
      }
      expect(
        screen.queryByRole('navigation', { name: 'Available views' }),
      ).not.toBeInTheDocument();
    },
  );

  it('disables the header entry during scope changes and without authentication', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const onContext = vi.fn();
    const tree = () => (
      <WorkbenchShell
        options={{
          ...baseOptions,
          workbench: { enabled: true, viewRail: { enabled: true } },
        }}
        locale="en-US"
        onRequestContextChange={onContext}
      >
        <WorkbenchToggleButton />
      </WorkbenchShell>
    );
    const { rerender } = render(tree());
    await waitFor(() => expect(screen.getByLabelText('Open views')).toBeEnabled());
    let resolveViews: (views: XpertExtensionViewManifest[]) => void = () =>
      undefined;
    mocks.listSlotViews.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveViews = resolve;
        }),
    );
    mocks.stream.conversationId = 'conversation-2';
    rerender(tree());
    expect(screen.getByLabelText('Open views')).toBeDisabled();
    await act(async () => {
      resolveViews([]);
    });
    expect(
      screen.queryByRole('navigation', { name: 'Available views' }),
    ).not.toBeInTheDocument();
    mocks.listSlotViews.mockResolvedValue([manifest]);
    mocks.stream.assistantId = 'agent-2';
    rerender(tree());
    await waitFor(() => expect(screen.getByLabelText('Open views')).toBeEnabled());
    mocks.stream.apiKey = '';
    rerender(tree());
    expect(screen.getByLabelText('Open views')).toBeDisabled();
  });

  it('opens views from the header in the narrow drawer', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    render(
      <WorkbenchShell
        options={{
          ...baseOptions,
          workbench: { enabled: true, viewRail: { enabled: true } },
        }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
        <span>Chat</span>
      </WorkbenchShell>,
    );
    await waitFor(() => expect(screen.getByLabelText('Open views')).toBeEnabled());
    act(() =>
      mocks.resizeCallback?.(
        [{ contentRect: { width: 600 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      ),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Documents' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Close views: Documents' }),
    );
    await waitFor(() => expect(screen.getByLabelText('Open views')).toBeEnabled());
  });

  it('opens a preview without unmounting its source view and closes back to the source', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    render(<WorkbenchShell options={{ ...baseOptions, workbench: { enabled: true } }} locale="en-US" onRequestContextChange={vi.fn()}><WorkbenchToggleButton /></WorkbenchShell>);
    await waitFor(() => expect(screen.getByLabelText('Open views')).toBeEnabled());
    fireEvent.click(screen.getByLabelText('Open views'));
    await waitFor(() => expect(mocks.remoteViewProps).not.toBeNull());
    const source = screen.getByTestId('remote-view');
    await act(async () => { await mocks.remoteViewProps?.onClientCommand('workbench.file.open', { name: 'Report', url: 'https://example.org/report', mimeType: 'image/png' }, manifest); });
    expect(screen.getByRole('tab', { name: 'Report' })).toHaveAttribute('aria-selected', 'true');
    expect(source).toBeInTheDocument();
    expect(source).not.toBeVisible();
    expect(screen.getByAltText('Report')).toHaveAttribute('src', 'https://example.org/report');
    fireEvent.click(screen.getByRole('button', { name: 'Close views: Report' }));
    expect(source).toBeVisible();
  });

  it('starts a new thread during a run instead of queueing to the previous thread', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    mocks.stream.isLoading = true;
    mocks.submit.mockResolvedValue(undefined);
    render(<WorkbenchShell options={{ ...baseOptions, workbench: { enabled: true } }} locale="en-US" onRequestContextChange={vi.fn()}><WorkbenchToggleButton /></WorkbenchShell>);
    await waitFor(() => expect(screen.getByLabelText('Open views')).toBeEnabled());
    fireEvent.click(screen.getByLabelText('Open views'));
    await waitFor(() => expect(mocks.remoteViewProps).not.toBeNull());
    let result: unknown;
    await act(async () => { result = await mocks.remoteViewProps?.onClientCommand('assistant.chat.send_message', { text: 'New task', newThread: true }, manifest); });
    expect(mocks.stream.reset).toHaveBeenCalledWith(null);
    expect(mocks.submit.mock.calls[0][1]).toMatchObject({ newThread: true });
    expect(mocks.submit.mock.calls[0][1].followUpMode).toBeUndefined();
    expect(result).toMatchObject({ success: true, status: 'sent' });
    expect(result).not.toHaveProperty('threadId');
  });

  it('moves only external output into a live native tab and reopens it without creating a thread', () => {
    mocks.stream.messages = externalMessages();
    const onContext = vi.fn();
    const tree = () => (
      <WorkbenchShell
        options={baseOptions}
        locale="en-US"
        onRequestContextChange={onContext}
      >
        <ExternalTranscript />
      </WorkbenchShell>
    );
    const { rerender } = render(tree());
    expect(screen.getByText('Main response')).toBeInTheDocument();
    expect(screen.getByText('Unchanged sub-agent output')).toBeInTheDocument();
    expect(screen.queryByText('External response')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'View execution: External review' }),
    );
    expect(
      screen.getByRole('tab', { name: 'External assistants' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('External response')).toBeInTheDocument();
    expect(screen.getByText('model-review')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'View execution: External review' }),
    );
    expect(
      screen.getAllByRole('tab', { name: 'External assistants' }),
    ).toHaveLength(1);
    mocks.stream.messages = externalMessages('External response updated');
    rerender(tree());
    expect(screen.getByText('External response updated')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Close external assistants' }),
    );
    expect(
      screen.queryByText('External response updated'),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'View execution: External review' }),
    );
    expect(screen.getByText('External response updated')).toBeInTheDocument();
    expect(mocks.copyThread).not.toHaveBeenCalled();
    expect(mocks.listSlotViews).not.toHaveBeenCalled();
    mocks.stream.threadId = 'thread-2';
    mocks.stream.messages = [];
    rerender(tree());
    expect(
      screen.queryByRole('tab', { name: 'External assistants' }),
    ).not.toBeInTheDocument();
  });

  it('keeps native details available while remote views load and after they fail', async () => {
    mocks.stream.messages = externalMessages();
    let rejectViews: (reason: Error) => void = () => undefined;
    mocks.listSlotViews.mockImplementation(() => new Promise((_, reject) => { rejectViews = reject; }));
    render(<WorkbenchShell options={{ ...baseOptions, workbench: { enabled: true } }} locale="en-US" onRequestContextChange={vi.fn()}><ExternalTranscript /></WorkbenchShell>);
    fireEvent.click(screen.getByRole('button', { name: 'View execution: External review' }));
    expect(screen.getByText('External response')).toBeInTheDocument();
    await act(async () => { rejectViews(new Error('Remote views failed')); });
    expect(screen.getByRole('tab', { name: 'External assistants' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('External response')).toBeInTheDocument();
    expect(screen.queryByText('Remote views failed')).not.toBeInTheDocument();
  });

  it('reopens a closed execution panel when the host requests the same attempt again', async () => {
    mocks.listSlotViews.mockResolvedValue([]);
    mocks.stream.messages = externalMessages();
    const tree = (requestId: string) => (
      <WorkbenchShell
        options={{
          ...baseOptions,
          request: {
            context: {
              env: {
                threadId: 'thread-1',
                executionId: 'external-1',
                executionFocusRequestId: requestId,
              },
            },
          },
        }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <ExternalTranscript />
      </WorkbenchShell>
    );
    const view = render(tree('navigation-1'));
    await screen.findByRole('tabpanel', { name: 'External assistants' });
    fireEvent.click(screen.getByRole('button', { name: 'Close external assistants' }));
    view.rerender(tree('navigation-1'));
    expect(
      screen.queryByRole('tabpanel', { name: 'External assistants' }),
    ).not.toBeInTheDocument();
    view.rerender(tree('navigation-2'));
    const panel = await screen.findByRole('tabpanel', {
      name: 'External assistants',
    });
    expect(within(panel).getByText('External response')).toBeInTheDocument();
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it('does not display a null execution error or null input from persisted history', () => {
    mocks.stream.messages = externalMessages();
    mocks.stream.messages[0].agentRuns![0] = {
      ...mocks.stream.messages[0].agentRuns![0], status: 'success', error: null, inputs: null,
    };
    render(<WorkbenchShell options={baseOptions} locale="en-US" onRequestContextChange={vi.fn()}><ExternalTranscript /></WorkbenchShell>);
    fireEvent.click(screen.getByRole('button', { name: 'View execution: External review' }));
    const panel = screen.getByRole('tabpanel', { name: 'External assistants' });
    expect(within(panel).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(panel).queryByText('null')).not.toBeInTheDocument();
    expect(within(panel).getByText('External response')).toBeInTheDocument();
  });

  it('shows the expert avatar in the call row, execution header and execution list', () => {
    mocks.stream.messages = externalMessages();
    mocks.stream.messages[0].agentRuns![0].avatar = { emoji: { id: 'memo', unified: '1f4dd' } };
    render(<ThemeProvider><WorkbenchShell options={baseOptions} locale="en-US" onRequestContextChange={vi.fn()}><ExternalTranscript /></WorkbenchShell></ThemeProvider>);
    const call = screen.getByRole('button', { name: 'View execution: External review' });
    expect(within(call).getByText('\u{1f4dd}')).toBeInTheDocument();
    fireEvent.click(call);
    const panel = screen.getByRole('tabpanel', { name: 'External assistants' });
    expect(within(panel).getByText('\u{1f4dd}')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to executions' }));
    const row = within(panel).getByRole('button', { name: 'View execution: External review' });
    expect(within(row).getByText('\u{1f4dd}')).toBeInTheDocument();
  });

  it('uses the shared transcript for input, Markdown, copying and streaming without allowing retry', () => {
    mocks.stream.messages = externalMessages('**Expert response**');
    const info = mocks.stream.messages[0].agentRuns![0];
    info.inputs = { input: 'Review this document' };
    const tree = () => (
      <WorkbenchShell
        options={baseOptions}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <ExternalTranscript />
      </WorkbenchShell>
    );
    const { rerender } = render(tree());
    fireEvent.click(
      screen.getByRole('button', { name: 'View execution: External review' }),
    );
    const panel = screen.getByRole('tabpanel', { name: 'External assistants' });
    const transcript = panel.querySelector(
      '[data-slot="chatkit-message-list"]',
    )! as HTMLElement;
    expect(within(transcript).getByText('Review this document')).toHaveClass(
      'text-sm',
    );
    expect(within(transcript).getByText('Expert response').tagName).toBe(
      'STRONG',
    );
    // Only the input can be copied while the answer is still streaming.
    expect(
      within(transcript).getAllByRole('button', { name: 'Copy to clipboard' }),
    ).toHaveLength(1);
    info.status = 'success';
    mocks.stream.messages = [...mocks.stream.messages];
    rerender(tree());
    expect(
      within(transcript).getAllByRole('button', { name: 'Copy to clipboard' }),
    ).toHaveLength(2);
    expect(
      within(transcript).queryByRole('button', { name: 'Regenerate response' }),
    ).not.toBeInTheDocument();
    expect(within(panel).queryByText('Main response')).not.toBeInTheDocument();
    expect(
      within(panel).queryByText('Unchanged sub-agent output'),
    ).not.toBeInTheDocument();
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it('retains the inline external group when the native feature is disabled', () => {
    mocks.stream.messages = externalMessages();
    render(<WorkbenchShell options={{ ...baseOptions, workbench: { externalAssistants: { enabled: false } } }} locale="en-US" onRequestContextChange={vi.fn()}><ExternalTranscript /></WorkbenchShell>);
    expect(screen.getByText('External response')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View execution: External review' })).not.toBeInTheDocument();
  });

  it('selects separate executions of the same external assistant from the list', () => {
    const first = externalMessages();
    mocks.stream.messages = [...first, { id: 'message-2', type: 'ai', executionId: 'root-2', content: [
      { type: 'text', text: 'Second execution output', executionId: 'external-2', parentExecutionId: 'root-2' },
    ], agentRuns: [{ id: 'external-2', parentId: 'root-2', invocationKind: 'external_assistant', title: 'External review', status: 'success' }] }];
    render(<WorkbenchShell options={baseOptions} locale="en-US" onRequestContextChange={vi.fn()}><ExternalTranscript /></WorkbenchShell>);
    fireEvent.click(screen.getAllByRole('button', { name: 'View execution: External review' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Back to executions' }));
    const panel = screen.getByRole('tabpanel');
    fireEvent.click(within(panel).getAllByRole('button', { name: 'View execution: External review' })[1]);
    expect(within(panel).getByText('Second execution output')).toBeInTheDocument();
    expect(within(panel).queryByText('External response')).not.toBeInTheDocument();
  });

  it('opens native execution details in the narrow-screen workbench drawer', () => {
    mocks.stream.messages = externalMessages();
    render(<WorkbenchShell options={baseOptions} locale="en-US" onRequestContextChange={vi.fn()}><ExternalTranscript /></WorkbenchShell>);
    act(() => mocks.resizeCallback?.([{ contentRect: { width: 720 } } as ResizeObserverEntry], {} as ResizeObserver));
    fireEvent.click(screen.getByRole('button', { name: 'View execution: External review' }));
    expect(within(screen.getByRole('dialog')).getByText('External response')).toBeInTheDocument();
  });

  it('releases modal locks when external details close or cross the narrow breakpoint', async () => {
    mocks.stream.messages = externalMessages();
    render(<WorkbenchShell options={baseOptions} locale="en-US" onRequestContextChange={vi.fn()}>
      <ExternalTranscript />
      <WorkbenchToggleButton />
      <input aria-label="Draft message" defaultValue="Keep my draft" />
    </WorkbenchShell>);
    setObservedWidth(1200);
    fireEvent.click(screen.getByRole('button', { name: 'View execution: External review' }));
    const details = screen.getByText('External response');
    const draft = screen.getByLabelText('Draft message');

    setObservedWidth(720);
    expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument();
    expect(document.body.style.pointerEvents).not.toBe('none');
    expect(draft.closest('[aria-hidden="true"]')).toBeNull();
    draft.focus();
    expect(draft).toHaveFocus();

    fireEvent.click(screen.getByLabelText('Open views'));
    expect(within(await screen.findByRole('dialog')).getByText('External response')).toBe(details);
    expect(document.body.style.pointerEvents).toBe('none');
    fireEvent.click(screen.getByLabelText('Show or hide sidebar'));
    await waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument());
    expect(document.body.style.pointerEvents).not.toBe('none');
    expect(draft.closest('[aria-hidden="true"]')).toBeNull();
    expect(draft).toHaveValue('Keep my draft');

    fireEvent.click(screen.getByLabelText('Open views'));
    setObservedWidth(1200);
    await waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument());
    expect(document.body.style.pointerEvents).not.toBe('none');
    expect(screen.getByText('External response')).toBe(details);
  });

  it('does not load or render controls when the option is disabled', () => {
    render(
      <WorkbenchShell
        options={baseOptions}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
      </WorkbenchShell>,
    );

    expect(mocks.listSlotViews).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Open views')).not.toBeInTheDocument();
  });

  it('waits for the client secret before preloading views', async () => {
    mocks.stream.apiKey = '';
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const view = render(
      <WorkbenchShell
        options={{
          ...baseOptions,
          workbench: { enabled: true },
        }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
      </WorkbenchShell>,
    );

    expect(mocks.listSlotViews).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Open views')).toBeDisabled();

    mocks.stream.apiKey = 'cs-x-ready';
    view.rerender(
      <WorkbenchShell
        options={{
          ...baseOptions,
          workbench: { enabled: true },
        }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
      </WorkbenchShell>,
    );

    await waitFor(() =>
      expect(mocks.listSlotViews).toHaveBeenCalledWith(
        'agent',
        'agent-1',
        'agent.workbench.fixed',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
  });

  it('loads supported views, starts closed, and opens a wide split panel', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    render(
      <WorkbenchShell
        options={{
          ...baseOptions,
          workbench: { enabled: true },
        }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
      </WorkbenchShell>,
    );
    setObservedWidth(1200);

    await waitFor(() =>
      expect(mocks.listSlotViews).toHaveBeenCalledWith(
        'agent',
        'agent-1',
        'agent.workbench.fixed',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(screen.queryByTestId('remote-view')).not.toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    expect(await screen.findByTestId('remote-view')).toHaveTextContent(
      'Documents',
    );
    expect(
      screen.queryByRole('heading', { name: 'Views' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Documents' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('separator')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close views: Documents'));
    expect(screen.queryByTestId('remote-view')).not.toBeInTheDocument();
  });

  it.each([
    ['conversationId', 'conversation-2'],
    ['projectId', 'project-2'],
    ['assistantId', 'agent-2'],
    ['organizationId', 'organization-2'],
    ['apiUrl', '/other-api/ai'],
  ] as const)('retains visited views only until %s changes', async (field, value) => {
    const secondManifest = {
      ...manifest,
      key: 'provider__browser',
      title: { en_US: 'Browser' },
    };
    mocks.listSlotViews.mockResolvedValue([manifest, secondManifest]);
    const onContext = vi.fn();
    const tree = () => (
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true } }}
        locale="en-US"
        onRequestContextChange={onContext}
      >
        <WorkbenchToggleButton />
      </WorkbenchShell>
    );
    const view = render(tree());
    setObservedWidth(1200);
    await waitFor(() => expect(screen.getByLabelText('Open views')).toBeEnabled());
    fireEvent.click(screen.getByLabelText('Open views'));
    const original = await screen.findByTestId('remote-view');
    const otherTab = original.textContent === 'Documents' ? 'Browser' : 'Documents';
    fireEvent.click(screen.getByRole('tab', { name: otherTab }));
    expect(screen.getAllByTestId('remote-view')).toHaveLength(2);
    expect(original).toBeInTheDocument();
    expect(original).not.toBeVisible();
    expect(mocks.remoteUnmounts).toBe(0);
    const previousFrames = screen.getAllByTestId('remote-view');

    mocks.stream[field] = value;
    view.rerender(tree());
    await waitFor(() => expect(mocks.listSlotViews).toHaveBeenLastCalledWith(
      'agent', mocks.stream.assistantId, 'agent.workbench.fixed', expect.objectContaining({
        runtimeScope: {
          projectId: mocks.stream.projectId,
          conversationId: mocks.stream.conversationId,
        },
      }),
    ));
    const openButton = screen.queryByLabelText('Open views');
    if (openButton) {
      await waitFor(() => expect(openButton).toBeEnabled());
      fireEvent.click(openButton);
    }
    await waitFor(() => expect(screen.getAllByTestId('remote-view')).toHaveLength(1));
    for (const frame of previousFrames) expect(frame).not.toBeInTheDocument();
    expect(mocks.remoteUnmounts).toBeGreaterThanOrEqual(2);
    expect(mocks.remoteViewProps).toEqual(expect.objectContaining({
      hostId: mocks.stream.assistantId,
      runtimeScope: {
        projectId: mocks.stream.projectId,
        conversationId: mocks.stream.conversationId,
      },
    }));
  });

  it('releases the old remote frame and reloads the scope when switching conversations', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const onContext = vi.fn();
    const tree = () => (
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true } }}
        locale="en-US"
        onRequestContextChange={onContext}
      >
        <WorkbenchToggleButton />
      </WorkbenchShell>
    );
    const view = render(tree());
    setObservedWidth(1200);
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    expect(await screen.findByTestId('remote-view')).toBeInTheDocument();
    expect(mocks.remoteViewProps).toEqual(
      expect.objectContaining({
        runtimeScope: {
          projectId: 'project-1',
          conversationId: 'conversation-1',
        },
      }),
    );
    mocks.stream.conversationId = 'conversation-2';
    view.rerender(tree());
    await waitFor(() =>
      expect(mocks.listSlotViews).toHaveBeenLastCalledWith(
        'agent',
        'agent-1',
        'agent.workbench.fixed',
        expect.objectContaining({
          runtimeScope: {
            projectId: 'project-1',
            conversationId: 'conversation-2',
          },
        }),
      ),
    );
    expect(mocks.remoteUnmounts).toBeGreaterThan(0);
    await waitFor(() =>
      expect(mocks.remoteViewProps).toEqual(
        expect.objectContaining({
          runtimeScope: {
            projectId: 'project-1',
            conversationId: 'conversation-2',
          },
        }),
      ),
    );
  });

  it('keeps the chat minimum until the pointer passes half of it, then restores the chat without remounting it', async () => {
    vi.stubGlobal('PointerEvent', class extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
    });
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const { container } = render(<WorkbenchShell options={{ ...baseOptions, workbench: { enabled: true } }} locale="en-US" onRequestContextChange={vi.fn()}><WorkbenchToggleButton /><input aria-label="Draft message" defaultValue="Keep my draft" /></WorkbenchShell>);
    setObservedWidth(1200);
    await waitFor(() => expect(screen.getByLabelText('Open views')).toBeEnabled());
    fireEvent.click(screen.getByLabelText('Open views'));
    await screen.findByTestId('remote-view');
    const root = container.querySelector('[data-chatkit-workbench-root]');
    if (!root) throw new Error('Missing workbench root');
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1200, 800));
    const separator = screen.getByRole('separator');
    fireEvent.pointerDown(separator, { button: 0, clientX: 540, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 200, pointerId: 1 });
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '384');
    expect(screen.getByLabelText('Draft message')).toBeVisible();
    fireEvent.pointerMove(window, { clientX: 191, pointerId: 1 });
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Draft message')).not.toBeVisible();
    fireEvent.click(screen.getByLabelText('Restore panel'));
    expect(screen.getByLabelText('Draft message')).toHaveValue('Keep my draft');
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '384');
    fireEvent.pointerMove(window, { clientX: 800, pointerId: 1 });
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '384');
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' });
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '400');
    vi.unstubAllGlobals();
  });

  it('swaps panes without remounting the draft or remote view and preserves their widths', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const { container } = render(<WorkbenchShell options={{ ...baseOptions, workbench: { enabled: true } }} locale="en-US" onRequestContextChange={vi.fn()}><WorkbenchToggleButton /><input aria-label="Draft message" defaultValue="Keep my draft" /></WorkbenchShell>);
    setObservedWidth(1200);
    await waitFor(() => expect(screen.getByLabelText('Open views')).toBeEnabled());
    expect(screen.queryByLabelText('Swap left and right panes')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Open views'));
    const remote = await screen.findByTestId('remote-view');
    const draft = screen.getByLabelText('Draft message');
    const root = container.querySelector('[data-chatkit-workbench-root]');
    fireEvent.click(screen.getByLabelText('Swap left and right panes'));
    expect(root).toHaveClass('flex-row-reverse');
    expect(screen.getByLabelText('Draft message')).toBe(draft);
    expect(draft).toHaveValue('Keep my draft');
    expect(screen.getByTestId('remote-view')).toBe(remote);
    expect(mocks.remoteUnmounts).toBe(0);
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '540');
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' });
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '524');
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowLeft' });
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '540');
    fireEvent.click(screen.getByLabelText('Expand panel'));
    expect(screen.queryByLabelText('Swap left and right panes')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Restore panel'));
    expect(root).toHaveClass('flex-row-reverse');
    fireEvent.click(screen.getByLabelText('Swap left and right panes'));
    expect(root).not.toHaveClass('flex-row-reverse');
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '540');
    expect(mocks.remoteUnmounts).toBe(0);
  });

  it('resizes a left workbench in the pointer direction and collapses chat toward the right', async () => {
    vi.stubGlobal('PointerEvent', class extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
    });
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const { container } = render(<WorkbenchShell options={{ ...baseOptions, workbench: { enabled: true } }} locale="en-US" onRequestContextChange={vi.fn()}><WorkbenchToggleButton /></WorkbenchShell>);
    setObservedWidth(1200);
    await waitFor(() => expect(screen.getByLabelText('Open views')).toBeEnabled());
    fireEvent.click(screen.getByLabelText('Open views'));
    await screen.findByTestId('remote-view');
    fireEvent.click(screen.getByLabelText('Swap left and right panes'));
    const root = container.querySelector('[data-chatkit-workbench-root]');
    if (!root) throw new Error('Missing workbench root');
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 0, 1200, 800));
    fireEvent.pointerDown(screen.getByRole('separator'), { button: 0, clientX: 760, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 660, pointerId: 1 });
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '640');
    fireEvent.pointerMove(window, { clientX: 860, pointerId: 1 });
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '440');
    fireEvent.pointerMove(window, { clientX: 1100, pointerId: 1 });
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '384');
    fireEvent.pointerMove(window, { clientX: 1109, pointerId: 1 });
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Restore panel'));
    expect(root).toHaveClass('flex-row-reverse');
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '384');
    vi.unstubAllGlobals();
  });

  it('remembers pane positions per assistant while narrow drawers leave the desktop preference intact', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const tree = () => (
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true } }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
      </WorkbenchShell>
    );
    const first = render(tree());
    setObservedWidth(1200);
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    fireEvent.click(screen.getByLabelText('Swap left and right panes'));
    first.unmount();
    const second = render(tree());
    setObservedWidth(1200);
    await screen.findByRole('separator');
    const root = second.container.querySelector(
      '[data-chatkit-workbench-root]',
    );
    expect(root).toHaveClass('flex-row-reverse');
    setObservedWidth(720);
    expect(root).not.toHaveClass('flex-row-reverse');
    expect(
      screen.queryByLabelText('Swap left and right panes'),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Open views'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Show or hide sidebar'));
    setObservedWidth(1200);
    expect(root).toHaveClass('flex-row-reverse');
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '540',
    );
    mocks.stream.assistantId = 'agent-2';
    second.rerender(tree());
    expect(root).not.toHaveClass('flex-row-reverse');
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    mocks.stream.assistantId = 'agent-1';
    second.rerender(tree());
    expect(root).toHaveClass('flex-row-reverse');
    await screen.findByRole('separator');
  });

  it('restores each assistant layout after remount, preserving chat width when the window changes', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const onContext = vi.fn();
    const tree = () => (
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true } }}
        locale="en-US"
        onRequestContextChange={onContext}
      >
        <WorkbenchToggleButton />
        <input aria-label="Draft message" />
      </WorkbenchShell>
    );
    const first = render(tree());
    setObservedWidth(1200);
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' });
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '556',
    );
    fireEvent.click(screen.getByLabelText('Expand panel'));
    first.unmount();

    const second = render(tree());
    setObservedWidth(1400);
    await screen.findByLabelText('Restore panel');
    expect(screen.getByLabelText('Draft message')).not.toBeVisible();
    fireEvent.click(screen.getByLabelText('Restore panel'));
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '556',
    );

    mocks.stream.assistantId = 'agent-2';
    second.rerender(tree());
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Open views'));
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'End' });
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '920',
    );
    mocks.stream.assistantId = 'agent-1';
    second.rerender(tree());
    await waitFor(() =>
      expect(screen.getByRole('separator')).toHaveAttribute(
        'aria-valuenow',
        '556',
      ),
    );
    mocks.stream.threadId = 'another-thread';
    second.rerender(tree());
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '556',
    );
    fireEvent.click(screen.getByLabelText('Show or hide sidebar'));
    second.unmount();
    render(tree());
    setObservedWidth(1200);
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('keeps desktop preferences while narrow drawers use a temporary layout', async () => {
    const key = workbenchLayoutKey('/api/ai', 'organization-1', 'agent-1');
    writeWorkbenchLayout(key, { open: true, expanded: true, chatWidth: 600, workbenchSide: 'right' });
    mocks.listSlotViews.mockResolvedValue([manifest]);
    render(<WorkbenchShell options={{ ...baseOptions, workbench: { enabled: true } }} locale="en-US" onRequestContextChange={vi.fn()}><WorkbenchToggleButton /></WorkbenchShell>);
    setObservedWidth(800);
    await waitFor(() => expect(screen.getByLabelText('Open views')).toBeEnabled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Open views'));
    fireEvent.click(screen.getByLabelText('Expand panel'));
    fireEvent.click(screen.getByLabelText('Show or hide sidebar'));
    setObservedWidth(1400);
    await screen.findByLabelText('Restore panel');
    fireEvent.click(screen.getByLabelText('Restore panel'));
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '600');
    setObservedWidth(1000);
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '520');
    setObservedWidth(1400);
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '600');
  });

  it('does not hide chat before saved workbench views become available', async () => {
    const key = workbenchLayoutKey('/api/ai', 'organization-1', 'agent-1');
    writeWorkbenchLayout(key, { open: true, expanded: true, chatWidth: 500, workbenchSide: 'right' });
    let resolveViews!: (views: XpertExtensionViewManifest[]) => void;
    mocks.listSlotViews.mockReturnValue(new Promise<XpertExtensionViewManifest[]>((resolve) => { resolveViews = resolve; }));
    render(<WorkbenchShell options={{ ...baseOptions, workbench: { enabled: true } }} locale="en-US" onRequestContextChange={vi.fn()}><WorkbenchToggleButton /><input aria-label="Draft message" /></WorkbenchShell>);
    setObservedWidth(1200);
    expect(screen.getByLabelText('Draft message')).toBeVisible();
    await act(async () => resolveViews([]));
    expect(screen.getByLabelText('Draft message')).toBeVisible();
    expect(screen.queryByLabelText('Restore panel')).not.toBeInTheDocument();
  });

  it('cancels a resize on lost focus and ignores later pointer movement', async () => {
    vi.stubGlobal('PointerEvent', class extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
    });
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const { container } = render(<WorkbenchShell options={{ ...baseOptions, workbench: { enabled: true } }} locale="en-US" onRequestContextChange={vi.fn()}><WorkbenchToggleButton /></WorkbenchShell>);
    setObservedWidth(1200);
    await waitFor(() => expect(screen.getByLabelText('Open views')).toBeEnabled());
    fireEvent.click(screen.getByLabelText('Open views'));
    await screen.findByTestId('remote-view');
    const root = container.querySelector('[data-chatkit-workbench-root]');
    if (!root) throw new Error('Missing root');
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1200, 800));
    fireEvent.pointerDown(screen.getByRole('separator'), { button: 0, clientX: 540, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 650, pointerId: 1 });
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '650');
    fireEvent.blur(window);
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '540');
    fireEvent.pointerMove(window, { clientX: 100, pointerId: 1 });
    expect(screen.getByRole('separator')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it.each(['right', 'left'])('shows the same main chat as the first maximized tab with the workbench on the %s', async (side) => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    let mounts = 0;
    let unmounts = 0;
    function MainChat() {
      const [count, setCount] = React.useState(0);
      React.useEffect(() => {
        mounts += 1;
        return () => { unmounts += 1; };
      }, []);
      return <>
        <WorkbenchToggleButton />
        <input aria-label="Main chat draft" defaultValue="Keep my draft" />
        <button onClick={() => setCount(value => value + 1)}>Local state {count}</button>
        <div role="region" aria-label="Main messages">Conversation messages</div>
      </>;
    }
    render(<WorkbenchShell options={{ ...baseOptions, workbench: { enabled: true } }} locale="en-US" onRequestContextChange={vi.fn()}><MainChat /></WorkbenchShell>);
    setObservedWidth(1200);
    await waitFor(() => expect(screen.getByLabelText('Open views')).toBeEnabled());
    const draft = screen.getByLabelText('Main chat draft');
    const messages = screen.getByRole('region', { name: 'Main messages' });
    messages.scrollTop = 80;
    fireEvent.change(draft, { target: { value: 'Unsent message' } });
    fireEvent.click(screen.getByRole('button', { name: 'Local state 0' }));
    fireEvent.click(screen.getByLabelText('Open views'));
    const remote = await screen.findByTestId('remote-view');
    if (side === 'left') fireEvent.click(screen.getByLabelText('Swap left and right panes'));
    expect(screen.queryByRole('tab', { name: 'Chat' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Expand panel'));
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Chat', 'Documents']);
    expect(screen.getByRole('tab', { name: 'Documents' })).toHaveAttribute('aria-selected', 'true');
    expect(draft).not.toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Chat' }));
    expect(within(screen.getByRole('tabpanel', { name: 'Chat' })).getByLabelText('Main chat draft')).toBe(draft);
    expect(draft).toBeVisible();
    expect(draft).toHaveValue('Unsent message');
    expect(messages.scrollTop).toBe(80);
    expect(screen.getByRole('button', { name: 'Local state 1' })).toBeVisible();
    expect(remote).not.toBeVisible();
    expect(screen.queryByLabelText('Close views: Chat')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Chat', 'Documents', 'New tab']);
    fireEvent.click(screen.getByRole('tab', { name: 'Chat' }));
    fireEvent.click(screen.getByLabelText('Restore panel'));
    expect(screen.queryByRole('tab', { name: 'Chat' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'New tab' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Main chat draft')).toBe(draft);
    expect(draft).toBeVisible();
    expect(draft).toHaveValue('Unsent message');
    expect(screen.getByTestId('remote-view')).toBe(remote);
    expect(mocks.remoteUnmounts).toBe(0);
    expect(mounts).toBe(1);
    expect(unmounts).toBe(0);
    fireEvent.click(screen.getByLabelText('Expand panel'));
    fireEvent.click(screen.getByRole('tab', { name: 'Chat' }));
    fireEvent.click(screen.getByLabelText('Show or hide sidebar'));
    expect(screen.getByLabelText('Main chat draft')).toBe(draft);
    expect(draft).toBeVisible();
    expect(unmounts).toBe(0);
  });

  it('keeps the main chat when the last maximized workbench tab is closed', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    render(<WorkbenchShell options={{ ...baseOptions, workbench: { enabled: true } }} locale="en-US" onRequestContextChange={vi.fn()}><WorkbenchToggleButton /><input aria-label="Main draft" /></WorkbenchShell>);
    setObservedWidth(1200);
    await waitFor(() => expect(screen.getByLabelText('Open views')).toBeEnabled());
    fireEvent.click(screen.getByLabelText('Open views'));
    fireEvent.click(screen.getByLabelText('Expand panel'));
    fireEvent.click(screen.getByLabelText('Close views: Documents'));
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Chat']);
    expect(screen.getByRole('tab', { name: 'Chat' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Main draft')).toBeVisible();
    fireEvent.click(screen.getByLabelText('Restore panel'));
    expect(screen.getByLabelText('Main draft')).toBeVisible();
    expect(screen.queryByRole('tab', { name: 'Chat' })).not.toBeInTheDocument();
  });

  it('moves main chat into the maximized narrow drawer and releases it on restore and breakpoint changes', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    render(<WorkbenchShell options={{ ...baseOptions, workbench: { enabled: true } }} locale="en-US" onRequestContextChange={vi.fn()}><WorkbenchToggleButton /><input aria-label="Main draft" defaultValue="Keep text" /></WorkbenchShell>);
    setObservedWidth(800);
    await waitFor(() => expect(screen.getByLabelText('Open views')).toBeEnabled());
    const draft = screen.getByLabelText('Main draft');
    fireEvent.click(screen.getByLabelText('Open views'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(screen.getByLabelText('Expand panel'));
    fireEvent.click(screen.getByRole('tab', { name: 'Chat' }));
    expect(within(dialog).getByLabelText('Main draft')).toBe(draft);
    expect(draft.closest('[aria-hidden="true"]')).toBeNull();
    draft.focus();
    expect(draft).toHaveFocus();
    fireEvent.change(draft, { target: { value: 'Edited in full screen' } });
    fireEvent.click(screen.getByLabelText('Restore panel'));
    expect(within(dialog).queryByLabelText('Main draft')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Documents' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByLabelText('Expand panel'));
    fireEvent.click(screen.getByRole('tab', { name: 'Chat' }));
    setObservedWidth(1200);
    await waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument());
    expect(screen.getByLabelText('Main draft')).toBe(draft);
    expect(draft).toHaveValue('Edited in full screen');
    expect(draft.closest('[aria-hidden="true"]')).toBeNull();
    expect(document.body.style.pointerEvents).not.toBe('none');
  });

  it('expands, restores, and hides the workbench from its action buttons', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    render(
      <WorkbenchShell
        options={{
          ...baseOptions,
          workbench: { enabled: true },
        }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
      </WorkbenchShell>,
    );
    setObservedWidth(1200);
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    await screen.findByTestId('remote-view');

    expect(screen.getByLabelText('Expand panel')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByLabelText('Close views')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Expand panel'));
    expect(screen.getByLabelText('Restore panel')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByLabelText('Close views')).not.toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(screen.getByTestId('remote-view')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Restore panel'));
    expect(screen.getByLabelText('Expand panel')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByLabelText('Close views')).not.toBeInTheDocument();
    expect(screen.getByRole('separator')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Expand panel'));
    fireEvent.click(screen.getByLabelText('Show or hide sidebar'));
    expect(screen.queryByTestId('remote-view')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Open views'));
    expect(await screen.findByTestId('remote-view')).toBeInTheDocument();
    expect(screen.getByLabelText('Expand panel')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('opens an empty state when no compatible views are available', async () => {
    mocks.listSlotViews.mockResolvedValue([]);
    render(
      <WorkbenchShell
        options={{
          ...baseOptions,
          workbench: { enabled: true },
        }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
      </WorkbenchShell>,
    );
    setObservedWidth(1200);
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );

    fireEvent.click(screen.getByLabelText('Open views'));
    expect(
      await screen.findByText('No compatible views are available.'),
    ).toBeInTheDocument();
  });

  it('maximizes the narrow drawer across the frame, hides chat and restores both without remounting', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    render(
      <WorkbenchShell
        options={{
          ...baseOptions,
          workbench: { enabled: true },
        }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
        <input aria-label="Draft message" defaultValue="Keep my draft" />
      </WorkbenchShell>,
    );
    setObservedWidth(1200);
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    expect(await screen.findByRole('separator')).toBeInTheDocument();

    setObservedWidth(800);
    await waitFor(() =>
      expect(screen.queryByTestId('remote-view')).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByTestId('remote-view')).toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    const draft = screen.getByLabelText('Draft message');
    const remoteView = screen.getByTestId('remote-view');
    expect(draft).toBeVisible();

    fireEvent.click(screen.getByLabelText('Expand panel'));
    expect(dialog).toHaveClass('inset-0', 'w-full', 'max-w-none', 'sm:max-w-none');
    expect(dialog).not.toHaveClass('sm:max-w-sm');
    expect(draft).not.toBeVisible();
    expect(screen.getByTestId('remote-view')).toBe(remoteView);
    expect(screen.getByLabelText('Restore panel')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByLabelText('Restore panel'));
    expect(dialog).toHaveClass('w-[min(92vw,720px)]');
    expect(draft).toBeVisible();
    expect(draft).toHaveValue('Keep my draft');
    expect(screen.getByTestId('remote-view')).toBe(remoteView);
    fireEvent.click(screen.getByLabelText('Expand panel'));
    fireEvent.click(screen.getByLabelText('Show or hide sidebar'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(draft).toBeVisible();
  });

  it('retains the frame during refresh but clears its context when access is revoked', async () => {
    mocks.listSlotViews.mockResolvedValueOnce([manifest]);
    const onRequestContextChange = vi.fn();
    const shell = (locale: string) => (
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true } }}
        locale={locale}
        onRequestContextChange={onRequestContextChange}
      >
        <WorkbenchToggleButton />
      </WorkbenchShell>
    );
    const { rerender } = render(shell('en-US'));
    setObservedWidth(1200);
    await waitFor(() => expect(screen.getByLabelText('Open views')).toBeEnabled());
    fireEvent.click(screen.getByLabelText('Open views'));
    const frame = await screen.findByTestId('remote-view');
    await act(async () => {
      await mocks.remoteViewProps?.onClientCommand('assistant.context.set', {
        key: 'documents',
        context: { collectionId: 'collection-1' },
      }, manifest);
    });
    const context = { documents: { collectionId: 'collection-1' } };
    expect(onRequestContextChange).toHaveBeenLastCalledWith(context);

    let rejectRefresh: (error: Error) => void = () => {};
    mocks.listSlotViews.mockImplementationOnce(() => new Promise((_, reject) => {
      rejectRefresh = reject;
    }));
    rerender(shell('zh-CN'));
    await waitFor(() => expect(mocks.listSlotViews).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('remote-view')).toBe(frame);
    expect(onRequestContextChange).toHaveBeenLastCalledWith(context);

    await act(async () => {
      rejectRefresh(Object.assign(new Error('Forbidden'), { status: 403 }));
    });
    expect(screen.queryByTestId('remote-view')).not.toBeInTheDocument();
    expect(onRequestContextChange).toHaveBeenLastCalledWith({});
  });

  it('merges view context and sends messages through the active stream', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    mocks.submit.mockResolvedValue(undefined);
    const onRequestContextChange = vi.fn();
    render(
      <WorkbenchShell
        options={{
          ...baseOptions,
          workbench: { enabled: true },
        }}
        locale="en-US"
        onRequestContextChange={onRequestContextChange}
      >
        <WorkbenchToggleButton />
      </WorkbenchShell>,
    );
    setObservedWidth(1200);
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    await screen.findByTestId('remote-view');

    await act(async () => {
      await mocks.remoteViewProps?.onClientCommand(
        'assistant.context.set',
        {
          key: 'documents',
          env: { region: 'eu', ignored: 42 },
          context: { collectionId: 'collection-1' },
        },
        manifest,
      );
    });
    expect(onRequestContextChange).toHaveBeenLastCalledWith({
      documents: { collectionId: 'collection-1' },
      env: { region: 'eu' },
    });

    mocks.stream.isLoading = true;
    await act(async () => {
      await mocks.remoteViewProps?.onClientCommand(
        'assistant.chat.send_message',
        {
          text: 'Summarize this document',
          clientMessageId: 'client-message-1',
          followUpMode: 'steer',
          state: { reviewer: { enabled: true } },
          attachments: [
            {
              id: 'file-1',
              name: 'report.pdf',
              mime_type: 'application/pdf',
            },
          ],
        },
        manifest,
      );
    });

    expect(mocks.submit).toHaveBeenCalledWith(
      {
        id: 'client-message-1',
        input: {
          input: 'Summarize this document',
          files: [
            expect.objectContaining({
              id: 'file-1',
              originalName: 'report.pdf',
              mimeType: 'application/pdf',
            }),
          ],
        },
        state: expect.objectContaining({
          reviewer: { enabled: true },
        }),
      },
      expect.objectContaining({ followUpMode: 'steer' }),
    );
  });

  it.each(['assistant.execution', 'assistant.conversation'])(
    'opens %s records from remote views without host navigation or resetting the chat',
    async (target) => {
      mocks.stream.messages = externalMessages();
      mocks.listSlotViews.mockResolvedValue([manifest]);
      const onClientCommand = vi.fn();
      const onNavigate = vi.fn();
      render(
        <WorkbenchShell
          options={{
            ...baseOptions,
            workbench: { enabled: true, onClientCommand },
          }}
          locale="en-US"
          onRequestContextChange={vi.fn()}
          onNavigate={onNavigate}
        >
          <WorkbenchToggleButton />
          <input aria-label="Draft" defaultValue="Keep my draft" />
        </WorkbenchShell>,
      );
      setObservedWidth(1200);
      await waitFor(() =>
        expect(screen.getByLabelText('Open views')).toBeEnabled(),
      );
      fireEvent.click(screen.getByLabelText('Open views'));
      fireEvent.click(await screen.findByRole('tab', { name: 'Documents' }));
      await waitFor(() => expect(mocks.remoteViewProps).not.toBeNull());
      for (let i = 0; i < 2; i++) {
        let response!: Promise<unknown>;
        act(() => {
          response = mocks.remoteViewProps!.onClientCommand(
            'workbench.navigation.open',
            {
              target,
              conversationId: 'conversation-1',
              threadId: 'thread-1',
              projectId: 'project-1',
              executionId: 'external-1',
            },
            manifest,
          );
        });
        expect(await response).toMatchObject({
          success: true,
          status: 'opened',
        });
        expect(
          await screen.findByText('External response'),
        ).toBeInTheDocument();
        if (i === 0)
          fireEvent.click(screen.getByLabelText('Close external assistants'));
      }
      expect(screen.getByLabelText('Draft')).toHaveValue('Keep my draft');
      expect(onClientCommand).not.toHaveBeenCalled();
      expect(onNavigate).not.toHaveBeenCalled();
      expect(mocks.stream.reset).not.toHaveBeenCalled();
      expect(mocks.listSlotViews).toHaveBeenCalledOnce();
    },
  );

  it('forwards manifest client commands to the configured callback', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const onClientCommand = vi.fn().mockResolvedValue({ opened: true });
    render(
      <WorkbenchShell
        options={{
          ...baseOptions,
          workbench: { enabled: true, onClientCommand },
        }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
      </WorkbenchShell>,
    );
    setObservedWidth(1200);
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    await screen.findByTestId('remote-view');

    await expect(
      mocks.remoteViewProps?.onClientCommand(
        'platform.custom.open',
        { url: '/file.pdf' },
        manifest,
      ),
    ).resolves.toEqual({ opened: true });
    expect(onClientCommand).toHaveBeenCalledWith({
      commandKey: 'platform.custom.open',
      payload: { url: '/file.pdf' },
      hostType: 'agent',
      hostId: 'agent-1',
      viewKey: manifest.key,
    });
  });

  it('copies once per source thread and reuses the native side chat for later selections', async () => {
    mocks.copyThread.mockResolvedValue({ thread_id: 'side-thread-1' });

    function SideChatLauncher() {
      const workbench = useWorkbench();
      return (
        <>
          <button
            type="button"
            onClick={() =>
              void workbench.askInSideChat({
                type: 'quote',
                text: 'first selection',
              })
            }
          >
            First
          </button>
          <button
            type="button"
            onClick={() =>
              void workbench.askInSideChat({
                type: 'quote',
                text: 'second selection',
              })
            }
          >
            Second
          </button>
        </>
      );
    }

    render(
      <WorkbenchShell
        options={{
          ...baseOptions,
          workbench: { sideChat: { enabled: true } },
        }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <SideChatLauncher />
      </WorkbenchShell>,
    );
    setObservedWidth(1200);

    fireEvent.click(screen.getByRole('button', { name: 'First' }));
    expect(await screen.findByTestId('side-chat')).toBeInTheDocument();
    expect(mocks.copyThread).toHaveBeenCalledTimes(1);
    expect(mocks.copyThread).toHaveBeenCalledWith('thread-1');
    expect(mocks.sideChatProps?.referenceRequest?.reference?.text).toBe(
      'first selection',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Second' }));
    await waitFor(() =>
      expect(mocks.sideChatProps?.referenceRequest?.reference?.text).toBe(
        'second selection',
      ),
    );
    expect(mocks.copyThread).toHaveBeenCalledTimes(1);

    // Collapsing the modal and moving between hosts must keep the running
    // side chat mounted, without retaining a hidden modal pointer lock.
    setObservedWidth(720);
    expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument();
    expect(document.body.style.pointerEvents).not.toBe('none');
    fireEvent.click(screen.getByRole('button', { name: 'Second' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(mocks.sideChatMounts).toBe(1);
    fireEvent.click(screen.getByLabelText('Show or hide sidebar'));
    await waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument());
    expect(document.body.style.pointerEvents).not.toBe('none');
    expect(mocks.sideChatUnmounts).toBe(0);
    setObservedWidth(1200);
    expect(screen.getByTestId('side-chat')).toBeInTheDocument();
    expect(mocks.copyThread).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Close views: Side chat'));
    expect(
      screen.getByRole('alertdialog', { name: 'Close side chat?' }),
    ).toBeInTheDocument();
    expect(mocks.sideChatMounts).toBe(1);
    expect(mocks.sideChatUnmounts).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('side-chat')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close views: Side chat'));
    fireEvent.click(screen.getByRole('checkbox', { name: "Don't ask again" }));
    fireEvent.click(screen.getByRole('button', { name: 'Close side chat' }));

    await waitFor(() =>
      expect(screen.queryByTestId('side-chat')).not.toBeInTheDocument(),
    );
    expect(mocks.sideChatUnmounts).toBe(1);
    expect(mocks.deleteThread).not.toHaveBeenCalled();
    expect(
      window.localStorage.getItem(SIDE_CHAT_CLOSE_CONFIRMATION_STORAGE_KEY),
    ).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Second' }));
    expect(await screen.findByTestId('side-chat')).toBeInTheDocument();
    expect(mocks.copyThread).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByLabelText('Close views: Side chat'));
    await waitFor(() =>
      expect(screen.queryByTestId('side-chat')).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(mocks.deleteThread).not.toHaveBeenCalled();
  });
});

function setObservedWidth(width: number) {
  act(() => {
    mocks.resizeCallback?.(
      [
        {
          contentRect: { width },
        } as ResizeObserverEntry,
      ],
      {} as ResizeObserver,
    );
  });
}
