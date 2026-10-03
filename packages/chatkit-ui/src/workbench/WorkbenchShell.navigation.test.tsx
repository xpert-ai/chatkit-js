import { describe, expect, it } from 'vitest';
import { setupWorkbenchTests, fixture } from './WorkbenchShell.test-fixture';
const {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  vi,
  mocks,
  WorkbenchShell,
  WorkbenchToggleButton,
  ThemeProvider,
  ExternalTranscript,
  externalMessages,
  manifest,
  baseOptions,
  setObservedWidth,
} = fixture;
import type { XpertExtensionViewManifest } from './WorkbenchShell.test-fixture';

describe('WorkbenchShell', () => {
  setupWorkbenchTests();
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
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
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
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
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
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
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
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
  });

  it('opens a preview without unmounting its source view and closes back to the source', async () => {
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
    await waitFor(() => expect(mocks.remoteViewProps).not.toBeNull());
    const source = screen.getByTestId('remote-view');
    await act(async () => {
      await mocks.remoteViewProps?.onClientCommand(
        'workbench.file.open',
        {
          name: 'Report',
          url: 'https://example.org/report',
          mimeType: 'image/png',
        },
        manifest,
      );
    });
    expect(screen.getByRole('tab', { name: 'Report' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(source).toBeInTheDocument();
    expect(source).not.toBeVisible();
    expect(screen.getByAltText('Report')).toHaveAttribute(
      'src',
      'https://example.org/report',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Close views: Report' }),
    );
    expect(source).toBeVisible();
  });

  it('starts a new thread during a run instead of queueing to the previous thread', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    mocks.stream.isLoading = true;
    mocks.submit.mockResolvedValue(undefined);
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
    await waitFor(() => expect(mocks.remoteViewProps).not.toBeNull());
    let result: unknown;
    await act(async () => {
      result = await mocks.remoteViewProps?.onClientCommand(
        'assistant.chat.send_message',
        { text: 'New task', newThread: true },
        manifest,
      );
    });
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
    mocks.listSlotViews.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectViews = reject;
        }),
    );
    render(
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true } }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <ExternalTranscript />
      </WorkbenchShell>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'View execution: External review' }),
    );
    expect(screen.getByText('External response')).toBeInTheDocument();
    await act(async () => {
      rejectViews(new Error('Remote views failed'));
    });
    expect(
      screen.getByRole('tab', { name: 'External assistants' }),
    ).toHaveAttribute('aria-selected', 'true');
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
    fireEvent.click(
      screen.getByRole('button', { name: 'Close external assistants' }),
    );
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
      ...mocks.stream.messages[0].agentRuns![0],
      status: 'success',
      error: null,
      inputs: null,
    };
    render(
      <WorkbenchShell
        options={baseOptions}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <ExternalTranscript />
      </WorkbenchShell>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'View execution: External review' }),
    );
    const panel = screen.getByRole('tabpanel', { name: 'External assistants' });
    expect(within(panel).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(panel).queryByText('null')).not.toBeInTheDocument();
    expect(within(panel).getByText('External response')).toBeInTheDocument();
  });

  it('shows the expert avatar in the call row, execution header and execution list', () => {
    mocks.stream.messages = externalMessages();
    mocks.stream.messages[0].agentRuns![0].avatar = {
      emoji: { id: 'memo', unified: '1f4dd' },
    };
    render(
      <ThemeProvider>
        <WorkbenchShell
          options={baseOptions}
          locale="en-US"
          onRequestContextChange={vi.fn()}
        >
          <ExternalTranscript />
        </WorkbenchShell>
      </ThemeProvider>,
    );
    const call = screen.getByRole('button', {
      name: 'View execution: External review',
    });
    expect(within(call).getByText('\u{1f4dd}')).toBeInTheDocument();
    fireEvent.click(call);
    const panel = screen.getByRole('tabpanel', { name: 'External assistants' });
    expect(within(panel).getByText('\u{1f4dd}')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to executions' }));
    const row = within(panel).getByRole('button', {
      name: 'View execution: External review',
    });
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
    render(
      <WorkbenchShell
        options={{
          ...baseOptions,
          workbench: { externalAssistants: { enabled: false } },
        }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <ExternalTranscript />
      </WorkbenchShell>,
    );
    expect(screen.getByText('External response')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'View execution: External review' }),
    ).not.toBeInTheDocument();
  });

  it('selects separate executions of the same external assistant from the list', () => {
    const first = externalMessages();
    mocks.stream.messages = [
      ...first,
      {
        id: 'message-2',
        type: 'ai',
        executionId: 'root-2',
        content: [
          {
            type: 'text',
            text: 'Second execution output',
            executionId: 'external-2',
            parentExecutionId: 'root-2',
          },
        ],
        agentRuns: [
          {
            id: 'external-2',
            parentId: 'root-2',
            invocationKind: 'external_assistant',
            title: 'External review',
            status: 'success',
          },
        ],
      },
    ];
    render(
      <WorkbenchShell
        options={baseOptions}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <ExternalTranscript />
      </WorkbenchShell>,
    );
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'View execution: External review',
      })[0],
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back to executions' }));
    const panel = screen.getByRole('tabpanel');
    fireEvent.click(
      within(panel).getAllByRole('button', {
        name: 'View execution: External review',
      })[1],
    );
    expect(
      within(panel).getByText('Second execution output'),
    ).toBeInTheDocument();
    expect(
      within(panel).queryByText('External response'),
    ).not.toBeInTheDocument();
  });

  it('opens native execution details in the narrow-screen workbench drawer', () => {
    mocks.stream.messages = externalMessages();
    render(
      <WorkbenchShell
        options={baseOptions}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <ExternalTranscript />
      </WorkbenchShell>,
    );
    act(() =>
      mocks.resizeCallback?.(
        [{ contentRect: { width: 720 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      ),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'View execution: External review' }),
    );
    expect(
      within(screen.getByRole('dialog')).getByText('External response'),
    ).toBeInTheDocument();
  });

  it('releases modal locks when external details close or cross the narrow breakpoint', async () => {
    mocks.stream.messages = externalMessages();
    render(
      <WorkbenchShell
        options={baseOptions}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <ExternalTranscript />
        <WorkbenchToggleButton />
        <input aria-label="Draft message" defaultValue="Keep my draft" />
      </WorkbenchShell>,
    );
    setObservedWidth(1200);
    fireEvent.click(
      screen.getByRole('button', { name: 'View execution: External review' }),
    );
    const details = screen.getByText('External response');
    const draft = screen.getByLabelText('Draft message');

    setObservedWidth(720);
    expect(
      screen.queryByRole('dialog', { hidden: true }),
    ).not.toBeInTheDocument();
    expect(document.body.style.pointerEvents).not.toBe('none');
    expect(draft.closest('[aria-hidden="true"]')).toBeNull();
    draft.focus();
    expect(draft).toHaveFocus();

    fireEvent.click(screen.getByLabelText('Open views'));
    expect(
      within(await screen.findByRole('dialog')).getByText('External response'),
    ).toBe(details);
    expect(document.body.style.pointerEvents).toBe('none');
    fireEvent.click(screen.getByLabelText('Show or hide sidebar'));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { hidden: true }),
      ).not.toBeInTheDocument(),
    );
    expect(document.body.style.pointerEvents).not.toBe('none');
    expect(draft.closest('[aria-hidden="true"]')).toBeNull();
    expect(draft).toHaveValue('Keep my draft');

    fireEvent.click(screen.getByLabelText('Open views'));
    setObservedWidth(1200);
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { hidden: true }),
      ).not.toBeInTheDocument(),
    );
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
  ] as const)(
    'retains views across context updates and replaces them at the %s identity boundary',
    async (field, value) => {
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
      await waitFor(() =>
        expect(screen.getByLabelText('Open views')).toBeEnabled(),
      );
      fireEvent.click(screen.getByLabelText('Open views'));
      const original = await screen.findByTestId('remote-view');
      const otherTab =
        original.textContent === 'Documents' ? 'Browser' : 'Documents';
      fireEvent.click(screen.getByRole('tab', { name: otherTab }));
      expect(screen.getAllByTestId('remote-view')).toHaveLength(2);
      expect(original).toBeInTheDocument();
      expect(original).not.toBeVisible();
      expect(mocks.remoteUnmounts).toBe(0);
      const previousFrames = screen.getAllByTestId('remote-view');

      mocks.stream[field] = value;
      view.rerender(tree());
      await waitFor(() =>
        expect(mocks.listSlotViews).toHaveBeenLastCalledWith(
          'agent',
          mocks.stream.assistantId,
          'agent.workbench.fixed',
          expect.objectContaining({
            runtimeScope: {
              projectId: mocks.stream.projectId,
              conversationId: mocks.stream.conversationId,
            },
          }),
        ),
      );
      const openButton = screen.queryByLabelText('Open views');
      if (openButton) {
        await waitFor(() => expect(openButton).toBeEnabled());
        fireEvent.click(openButton);
      }
      if (field === 'conversationId' || field === 'projectId') {
        expect(screen.getAllByTestId('remote-view')).toEqual(previousFrames);
        expect(mocks.remoteUnmounts).toBe(0);
      } else {
        await waitFor(() =>
          expect(screen.getAllByTestId('remote-view')).toHaveLength(1),
        );
        for (const frame of previousFrames)
          expect(frame).not.toBeInTheDocument();
        expect(mocks.remoteUnmounts).toBeGreaterThanOrEqual(2);
      }
      expect(mocks.remoteViewProps).toEqual(
        expect.objectContaining({
          hostId: mocks.stream.assistantId,
          runtimeScope: {
            projectId: mocks.stream.projectId,
            conversationId: mocks.stream.conversationId,
          },
        }),
      );
    },
  );

  it('retains the remote frame and revalidates scope when switching conversations', async () => {
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
    expect(mocks.remoteUnmounts).toBe(0);
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
    vi.stubGlobal(
      'PointerEvent',
      class extends MouseEvent {
        readonly pointerId: number;
        constructor(type: string, init: PointerEventInit = {}) {
          super(type, init);
          this.pointerId = init.pointerId ?? 1;
        }
      },
    );
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const { container } = render(
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true } }}
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
    await screen.findByTestId('remote-view');
    const root = container.querySelector('[data-chatkit-workbench-root]');
    if (!root) throw new Error('Missing workbench root');
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 1200, 800),
    );
    const separator = screen.getByRole('separator');
    fireEvent.pointerDown(separator, { button: 0, clientX: 540, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 200, pointerId: 1 });
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '384',
    );
    expect(screen.getByLabelText('Draft message')).toBeVisible();
    fireEvent.pointerMove(window, { clientX: 191, pointerId: 1 });
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Draft message')).not.toBeVisible();
    fireEvent.click(screen.getByLabelText('Restore panel'));
    expect(screen.getByLabelText('Draft message')).toHaveValue('Keep my draft');
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '384',
    );
    fireEvent.pointerMove(window, { clientX: 800, pointerId: 1 });
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '384',
    );
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' });
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '400',
    );
    vi.unstubAllGlobals();
  });
});
