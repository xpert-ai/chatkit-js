import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ThreadGoal } from '@xpert-ai/chatkit-types';
import { describe, expect, it, vi } from 'vitest';
import {
  baseChatOptions,
  Chat,
  createGoalAdapter,
  enableGoalRuntimeCommand,
  mocks,
  renderChat,
  setComposerText,
  setupChatTest,
} from '../testing/chat-fixture';

describe('Chat Goal lifecycle', () => {
  setupChatTest();
  it('does not show a goal card when /goal returns no existing goal', async () => {
    enableGoalRuntimeCommand();
    mocks.stream.threadId = 'thread-1';
    const adapter = createGoalAdapter();

    renderChat({ goal: adapter });

    await waitFor(() =>
      expect(adapter.getGoal).toHaveBeenCalledWith({
        threadId: 'thread-1',
        signal: expect.any(AbortSignal),
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText('chat.goal.label')).toBeNull(),
    );

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/goal');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(adapter.getGoal).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('chat.goal.label')).toBeNull();
    expect(mocks.stream.submit).not.toHaveBeenCalled();
  });

  it('does not show a goal card for /goal before a thread exists', async () => {
    enableGoalRuntimeCommand();
    const adapter = createGoalAdapter();

    renderChat({ goal: adapter });

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/goal');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    expect(screen.queryByText('chat.goal.label')).toBeNull();
    expect(screen.queryByText('chat.goal.startThreadRequired')).toBeNull();
    expect(adapter.getGoal).not.toHaveBeenCalled();
    expect(mocks.stream.submit).not.toHaveBeenCalled();
  });

  it('starts a hidden goal run after creating a goal on a new thread', async () => {
    enableGoalRuntimeCommand();
    const adapter = createGoalAdapter();

    renderChat({ goal: adapter });

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/goal ship feature');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() =>
      expect(adapter.setGoal).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: null,
          objective: 'ship feature',
        }),
      ),
    );
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));

    expect(mocks.stream.reset).toHaveBeenCalledWith('thread-1', []);
    expect(mocks.stream.submit.mock.calls[0][0].input).toMatchObject({
      input: 'Continue working toward the active goal.',
      commandSource: expect.objectContaining({
        type: 'slash_command',
        name: 'goal',
        source: 'runtime',
      }),
      goalRun: true,
    });
    expect(mocks.stream.submit.mock.calls[0][1]).toMatchObject({
      threadId: 'thread-1',
      joinExistingThread: true,
    });
    expect(mocks.stream.submit.mock.calls[0][1]).not.toHaveProperty(
      'optimisticValues',
    );
    expect(screen.queryByText('ship feature')).toBeNull();
  });

  it('passes the selected Project into first-goal conversation setup', async () => {
    enableGoalRuntimeCommand();
    const adapter = createGoalAdapter();
    mocks.stream.connectorBindingIds = ['binding-1'];

    render(
      <Chat
        clientSecret="secret"
        options={{ ...baseChatOptions, goal: adapter }}
        activeProjectId="project-1"
        projectsEnabled
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    setComposerText(screen.getByRole('textbox'), '/goal ship feature');
    fireEvent.click(screen.getByRole('button', { name: 'send' }));

    await waitFor(() =>
      expect(adapter.setGoal).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: null,
          assistantId: mocks.stream.assistantId,
          projectId: 'project-1',
          objective: 'ship feature',
          runtimeCapabilities: expect.objectContaining({
            connectors: { bindingIds: ['binding-1'] },
          }),
        }),
      ),
    );
  });

  it('uses the latest selected Project when a stable Goal adapter is reused', async () => {
    enableGoalRuntimeCommand();
    const adapter = createGoalAdapter();
    const options = { ...baseChatOptions, goal: adapter };
    const { rerender } = render(
      <Chat
        clientSecret="secret"
        options={options}
        activeProjectId="project-1"
        projectsEnabled
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    rerender(
      <Chat
        clientSecret="secret"
        options={options}
        activeProjectId="project-2"
        projectsEnabled
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    setComposerText(screen.getByRole('textbox'), '/goal ship feature');
    fireEvent.click(screen.getByRole('button', { name: 'send' }));

    await waitFor(() =>
      expect(adapter.setGoal).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: null,
          projectId: 'project-2',
          objective: 'ship feature',
        }),
      ),
    );
  });

  it('locks Project selection and ignores a stale first-goal result after the Project changes', async () => {
    enableGoalRuntimeCommand();
    let resolveGoal:
      | ((value: { threadId: string; goal: ThreadGoal }) => void)
      | null = null;
    const adapter = createGoalAdapter({
      setGoal: vi.fn(
        () =>
          new Promise<{ threadId: string; goal: ThreadGoal }>((resolve) => {
            resolveGoal = resolve;
          }),
      ),
    });
    const options = { ...baseChatOptions, goal: adapter };
    const onProjectChange = vi.fn();
    const { rerender } = render(
      <Chat
        clientSecret="secret"
        options={options}
        activeProjectId="project-1"
        projectsEnabled
        onProjectChange={onProjectChange}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    setComposerText(screen.getByRole('textbox'), '/goal ship feature');
    fireEvent.click(screen.getByRole('button', { name: 'send' }));

    await waitFor(() => expect(adapter.setGoal).toHaveBeenCalledTimes(1));
    const goalSignal = vi.mocked(adapter.setGoal).mock.calls[0]?.[0].signal;
    expect(goalSignal).toBeDefined();
    expect(screen.getByTestId('project-selector')).toBeDisabled();
    fireEvent.click(screen.getByTestId('project-selector'));
    expect(onProjectChange).not.toHaveBeenCalled();

    rerender(
      <Chat
        clientSecret="secret"
        options={options}
        activeProjectId="project-2"
        projectsEnabled
        onProjectChange={onProjectChange}
      />,
    );
    expect(goalSignal?.aborted).toBe(true);
    await act(async () => {
      resolveGoal?.({
        threadId: 'thread-project-1',
        goal: {
          id: 'goal-project-1',
          threadId: 'thread-project-1',
          objective: 'ship feature',
          status: 'active',
          tokensUsed: 0,
          elapsedSeconds: 0,
          continuationCount: 0,
        },
      });
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.getByTestId('project-selector')).not.toBeDisabled(),
    );
    expect(mocks.stream.reset).not.toHaveBeenCalled();
    expect(mocks.stream.submit).not.toHaveBeenCalled();
    expect(screen.queryByText('ship feature')).toBeNull();
  });

  it('keeps the draft thread state clean when first-goal setup fails', async () => {
    enableGoalRuntimeCommand();
    const adapter = createGoalAdapter({
      setGoal: vi.fn(async () => {
        throw new Error('Goal setup failed');
      }),
    });

    renderChat({ goal: adapter });

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    setComposerText(screen.getByRole('textbox'), '/goal ship feature');
    fireEvent.click(screen.getByRole('button', { name: 'send' }));

    expect(await screen.findByText('Goal setup failed')).toBeInTheDocument();
    expect(mocks.stream.reset).not.toHaveBeenCalled();
    expect(mocks.stream.submit).not.toHaveBeenCalled();
    expect(mocks.stream.threadId).toBeNull();
  });

  it('expands and collapses the active goal objective', async () => {
    enableGoalRuntimeCommand();
    mocks.stream.threadId = 'thread-1';
    mocks.stream.isLoading = true;
    const activeGoal: ThreadGoal = {
      id: 'goal-1',
      threadId: 'thread-1',
      objective:
        'ship the feature with a long objective that should be collapsible',
      status: 'active',
      tokensUsed: 0,
      elapsedSeconds: 0,
      continuationCount: 0,
    };
    (mocks.stream as { threadGoal?: ThreadGoal | null }).threadGoal =
      activeGoal;
    const adapter = createGoalAdapter({
      getGoal: vi.fn(async () => activeGoal),
    });

    renderChat({ goal: adapter });

    await waitFor(() => expect(adapter.getGoal).toHaveBeenCalled());

    const objective = await screen.findByText(activeGoal.objective);
    expect(objective).toHaveClass('truncate');

    fireEvent.click(
      screen.getByRole('button', { name: 'chat.goal.expandObjective' }),
    );

    expect(objective).not.toHaveClass('truncate');
    expect(objective).toHaveClass('whitespace-pre-wrap');

    fireEvent.click(
      screen.getByRole('button', { name: 'chat.goal.collapseObjective' }),
    );

    expect(objective).toHaveClass('truncate');
  });

  it('toggles goal mode from the slash palette without inserting /goal', async () => {
    enableGoalRuntimeCommand();
    const adapter = createGoalAdapter();

    renderChat({ goal: adapter });

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/go');
    fireEvent.mouseDown(await screen.findByText('Goal'));

    expect(screen.getByRole('textbox').textContent).toBe('');
    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-on');
    expect(screen.queryByText('chat.goal.label')).toBeNull();
    expect(adapter.getGoal).not.toHaveBeenCalled();
    expect(mocks.stream.submit).not.toHaveBeenCalled();

    setComposerText(screen.getByRole('textbox'), '/go');
    fireEvent.mouseDown(await screen.findByText('Goal'));

    expect(screen.getByRole('textbox').textContent).toBe('');
    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-off');
  });

  it('clears stale goal UI when the goal adapter becomes unavailable', async () => {
    enableGoalRuntimeCommand();
    mocks.stream.threadId = 'thread-1';
    mocks.stream.isLoading = true;
    const activeGoal: ThreadGoal = {
      id: 'goal-1',
      threadId: 'thread-1',
      objective: 'ship feature',
      status: 'active',
      tokensUsed: 0,
      elapsedSeconds: 0,
      continuationCount: 0,
    };
    const adapter = createGoalAdapter({
      getGoal: vi.fn(async () => activeGoal),
    });

    const { rerender } = render(
      <Chat
        clientSecret="secret"
        options={{
          ...baseChatOptions,
          goal: adapter,
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('ship feature')).toBeInTheDocument(),
    );

    rerender(<Chat clientSecret="secret" options={baseChatOptions} />);

    await waitFor(() => expect(screen.queryByText('ship feature')).toBeNull());
  });
});
