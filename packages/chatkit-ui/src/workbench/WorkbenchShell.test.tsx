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
  manifest,
  baseOptions,
  setObservedWidth,
  CHATKIT_INTERNAL_PARENT_EVENT,
} = fixture;

describe('WorkbenchShell', () => {
  setupWorkbenchTests();
  it('opens side chat from the guide without requiring a message reference', async () => {
    mocks.listSlotViews.mockResolvedValue([]);
    mocks.copyThread.mockResolvedValue({ thread_id: 'side-thread' });
    render(
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true } }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
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
    await screen.findByRole('tab', { name: 'New tab' });
    fireEvent.click(screen.getByRole('button', { name: 'Side chat' }));
    await screen.findByTestId('side-chat');
    expect(mocks.copyThread).toHaveBeenCalledWith('thread-1');
    expect(mocks.sideChatProps?.referenceRequest).toBeUndefined();
    expect(screen.getByLabelText('Draft')).toHaveValue('Keep my draft');
    expect(
      screen.queryByRole('tab', { name: 'New tab' }),
    ).not.toBeInTheDocument();
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
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
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
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Documents',
      'b.html',
      'New tab',
    ]);
    const frame = within(
      screen.getByRole('region', { name: 'b.html' }),
    ).getByTitle('b.html');
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(frame).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'b.html' })).getByTitle(
        'b.html',
      ),
    ).toHaveAttribute('src', 'https://example.test/b.html');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('combobox')).toHaveValue(
      'https://example.test/a.html',
    );
    fireEvent.keyDown(screen.getByRole('button', { name: 'Page options' }), {
      key: 'ArrowDown',
    });
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Recent websites' }),
    );
    fireEvent.click(await screen.findByRole('option', { name: /a.html/ }));
    expect(screen.getByRole('combobox')).toHaveValue(
      'https://example.test/a.html',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Common tools' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }));
    expect(screen.getByRole('tab', { name: 'a.html' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.keyDown(screen.getByRole('button', { name: 'Page options' }), {
      key: 'ArrowDown',
    });
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Back to new tab' }),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Files / folders' }));
    });
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Documents',
      'Open file',
      'New tab',
    ]);
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
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'example.test/a.html' },
    });
    fireEvent.submit(screen.getByRole('search'));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    });
    expect(screen.getByRole('button', { name: 'Forward' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /a.html Website/ }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }));
    expect(screen.getByRole('combobox')).toHaveValue(
      'https://example.test/a.html',
    );
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

  it.each(['projectId', 'organizationId', 'assistantId'] as const)(
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
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
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
    const second = {
      ...manifest,
      key: 'second',
      title: 'Second view',
      workbench: { openMode: 'on-demand' as const, menu: { enabled: true } },
    };
    mocks.listSlotViews.mockResolvedValue([
      { ...manifest, key: 'hidden', title: 'Hidden view', visible: false },
      {
        ...manifest,
        key: 'no-menu',
        title: 'No menu view',
        workbench: { openMode: 'on-demand', menu: { enabled: false } },
      },
      second,
      {
        ...manifest,
        workbench: { openMode: 'on-demand', menu: { enabled: true } },
      },
    ]);
    render(
      <WorkbenchShell
        options={{
          ...baseOptions,
          workbench: { enabled: true, viewRail: { enabled: true } },
        }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <header>
          <WorkbenchToggleButton />
        </header>
        <input aria-label="Draft" defaultValue="Keep this message" />
      </WorkbenchShell>,
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    expect(screen.getAllByRole('button', { name: 'Open views' })).toHaveLength(
      1,
    );
    expect(
      screen.queryByRole('navigation', { name: 'Available views' }),
    ).not.toBeInTheDocument();
    const trigger = screen.getByLabelText('Open views');
    expect(trigger).toHaveTextContent('2');
    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    const menu = await screen.findByRole('dialog', { name: 'Available views' });
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(
      within(menu)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Documents', 'Second view']);
    fireEvent.pointerLeave(trigger);
    fireEvent.pointerEnter(menu);
    await act(() => new Promise((resolve) => setTimeout(resolve, 200)));
    expect(menu).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Second view' }));
    expect(screen.getByRole('tab', { name: 'Second view' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByLabelText('Draft')).toHaveValue('Keep this message');
    fireEvent.click(screen.getByLabelText('Show or hide sidebar'));
    expect(screen.getByLabelText('Open views')).toBeEnabled();
    fireEvent.click(screen.getByLabelText('Open views'));
    expect(screen.getByRole('tab', { name: 'Second view' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByLabelText('Draft')).toHaveValue('Keep this message');
  });

  it('dismisses the hover menu and supports keyboard selection without opening a view on hover', async () => {
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
    const trigger = screen.getByLabelText('Open views');
    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    const menu = await screen.findByRole('dialog', { name: 'Available views' });
    expect(screen.queryByTestId('remote-view')).not.toBeInTheDocument();
    fireEvent.pointerLeave(trigger);
    fireEvent.pointerLeave(menu);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const view = await screen.findByRole('button', { name: 'Documents' });
    await waitFor(() => expect(view).toHaveFocus());
    fireEvent.keyDown(view, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('button', { name: 'Documents' }));
    expect(
      await screen.findByRole('tab', { name: 'Documents' }),
    ).toHaveAttribute('aria-selected', 'true');
  });
});
