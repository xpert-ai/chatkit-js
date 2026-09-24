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
    },
    apiKey: 'cs-x-secret',
    apiUrl: '/api/ai',
    authenticatedFetch: vi.fn(),
    assistantId: 'agent-1',
    projectId: 'project-1',
    organizationId: 'organization-1',
    threadId: 'thread-1',
    isLoading: false,
    messages: [] as StateType['messages'],
    submit: vi.fn(),
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

vi.mock('./RemoteViewFrame', () => ({
  RemoteViewFrame: (props: {
    title: string;
    onClientCommand: (
      commandKey: string,
      payload: unknown,
      manifest: XpertExtensionViewManifest,
    ) => Promise<unknown>;
  }) => {
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
import { AssistantMessage } from '../components/thread/messages/ai';
import { toWorkbenchMessages } from './external-assistant-runs';
import { ThemeProvider } from '../providers/Theme';

const render = (ui: React.ReactElement) =>
  renderUI(ui, { wrapper: ThemeProvider });

function ExternalTranscript() {
  return <>{toWorkbenchMessages(mocks.stream.messages).map((message) =>
    <AssistantMessage key={message.id} message={{ ...message, type: 'assistant' }} />)}</>;
}

function externalMessages(text = 'External response'): StateType['messages'] {
  return [{ id: 'message-1', type: 'ai', executionId: 'root', content: [
    { type: 'text', text: 'Main response' },
    { type: 'text', text, executionId: 'external-1', parentExecutionId: 'root' },
    { type: 'text', text: 'Unchanged sub-agent output', executionId: 'sub-1', parentExecutionId: 'root' },
  ], agentRuns: [
    { id: 'external-1', parentId: 'root', invocationKind: 'external_assistant', title: 'External review', model: 'model-review', status: 'running' },
    { id: 'sub-1', parentId: 'root', invocationKind: 'sub_agent', title: 'Internal reviewer', status: 'running' },
  ] }];
}

const manifest: XpertExtensionViewManifest = {
  key: 'provider__documents',
  title: { en_US: 'Documents', zh_Hans: '文档' },
  hostType: 'agent',
  slot: 'agent.workbench.fixed',
  order: 10,
  source: { provider: 'provider' },
  workbench: { fixed: true, menu: { enabled: true, order: 10 } },
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
  constructor(callback: ResizeObserverCallback) {
    mocks.resizeCallback = callback;
  }
  observe() {}
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
    mocks.stream.isLoading = false;
    mocks.stream.apiKey = 'cs-x-secret';
    mocks.stream.messages = [];
    mocks.stream.threadId = 'thread-1';
    window.localStorage.removeItem(SIDE_CHAT_CLOSE_CONFIRMATION_STORAGE_KEY);
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  it('moves only external output into a live native tab and reopens it without creating a thread', () => {
    mocks.stream.messages = externalMessages();
    const onContext = vi.fn();
    const tree = () => <WorkbenchShell options={baseOptions} locale="en-US" onRequestContextChange={onContext}><ExternalTranscript /></WorkbenchShell>;
    const { rerender } = render(tree());
    expect(screen.getByText('Main response')).toBeInTheDocument();
    expect(screen.getByText('Unchanged sub-agent output')).toBeInTheDocument();
    expect(screen.queryByText('External response')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View execution: External review' }));
    expect(screen.getByRole('tab', { name: 'External assistants' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('External response')).toBeInTheDocument();
    expect(screen.getByText('model-review')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View execution: External review' }));
    expect(screen.getAllByRole('tab', { name: 'External assistants' })).toHaveLength(1);
    mocks.stream.messages = externalMessages('External response updated');
    rerender(tree());
    expect(screen.getByText('External response updated')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close external assistants' }));
    expect(screen.queryByText('External response updated')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View execution: External review' }));
    expect(screen.getByText('External response updated')).toBeInTheDocument();
    expect(mocks.copyThread).not.toHaveBeenCalled();
    expect(mocks.listSlotViews).not.toHaveBeenCalled();
    mocks.stream.threadId = 'thread-2';
    mocks.stream.messages = [];
    rerender(tree());
    expect(screen.queryByRole('tab', { name: 'External assistants' })).not.toBeInTheDocument();
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
    const tree = () => <WorkbenchShell options={baseOptions} locale="en-US" onRequestContextChange={vi.fn()}><ExternalTranscript /></WorkbenchShell>;
    const { rerender } = render(tree());
    fireEvent.click(screen.getByRole('button', { name: 'View execution: External review' }));
    const panel = screen.getByRole('tabpanel', { name: 'External assistants' });
    const transcript = panel.querySelector('[data-slot="chatkit-message-list"]')! as HTMLElement;
    expect(within(transcript).getByText('Review this document')).toHaveClass('text-sm');
    expect(within(transcript).getByText('Expert response').tagName).toBe('STRONG');
    // Only the input can be copied while the answer is still streaming.
    expect(within(transcript).getAllByRole('button', { name: 'Copy to clipboard' })).toHaveLength(1);
    info.status = 'success';
    mocks.stream.messages = [...mocks.stream.messages];
    rerender(tree());
    expect(within(transcript).getAllByRole('button', { name: 'Copy to clipboard' })).toHaveLength(2);
    expect(within(transcript).queryByRole('button', { name: 'Regenerate response' })).not.toBeInTheDocument();
    expect(within(panel).queryByText('Main response')).not.toBeInTheDocument();
    expect(within(panel).queryByText('Unchanged sub-agent output')).not.toBeInTheDocument();
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

  it('closes when becoming narrow and reopens in a right-side drawer', async () => {
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

    fireEvent.click(screen.getByLabelText('Expand panel'));
    expect(dialog).toHaveClass('w-screen');
    expect(screen.getByLabelText('Restore panel')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
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
        'workbench.file.open',
        { url: '/file.pdf' },
        manifest,
      ),
    ).resolves.toEqual({ opened: true });
    expect(onClientCommand).toHaveBeenCalledWith({
      commandKey: 'workbench.file.open',
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
