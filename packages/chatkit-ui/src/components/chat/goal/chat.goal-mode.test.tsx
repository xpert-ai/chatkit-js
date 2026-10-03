import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { ThreadGoal } from '@xpert-ai/chatkit-types';
import { describe, expect, it, vi } from 'vitest';
import {
  baseChatOptions,
  Chat,
  createGoalAdapter,
  enableGoalRuntimeCommand,
  enableSelectableGoalRuntimeCommand,
  getSubmittedOptimisticMessages,
  mocks,
  renderChat,
  setComposerText,
  setupChatTest,
} from '../testing/chat-fixture';

describe('Chat Goal input mode', () => {
  setupChatTest();
  it('toggles the goal switch without showing an empty card when no goal exists', async () => {
    enableGoalRuntimeCommand();

    renderChat();

    await waitFor(() =>
      expect(screen.getByTestId('goal-command-available')).toHaveTextContent(
        'goal-ready',
      ),
    );
    const composerShell = document.querySelector(
      '[data-slot="composer-input-shell"]',
    );
    expect(composerShell).toHaveAttribute('data-layout', 'stacked');

    fireEvent.click(screen.getByTestId('goal-command'));

    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-on');
    expect(composerShell).toHaveAttribute('data-layout', 'stacked');
    expect(screen.queryByText('chat.goal.label')).toBeNull();
    expect(screen.getByRole('textbox').textContent).toBe('');

    fireEvent.click(screen.getByTestId('goal-command'));

    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-off');
    expect(composerShell).toHaveAttribute('data-layout', 'stacked');
  });

  it('shows the goal switch only when the runtime goal plugin is selected', async () => {
    enableSelectableGoalRuntimeCommand();

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );
    expect(screen.getByTestId('goal-command-available')).toHaveTextContent(
      'goal-hidden',
    );

    fireEvent.click(screen.getByTestId('select-plugin'));

    await waitFor(() =>
      expect(screen.getByTestId('selected-plugins')).toHaveTextContent(
        'middleware-1',
      ),
    );
    expect(screen.getByTestId('goal-command-available')).toHaveTextContent(
      'goal-ready',
    );

    fireEvent.click(screen.getByTestId('clear-plugin'));

    await waitFor(() =>
      expect(screen.getByTestId('selected-plugins')).toHaveTextContent(''),
    );
    expect(screen.getByTestId('goal-command-available')).toHaveTextContent(
      'goal-hidden',
    );
  });

  it('submits goal mode input as a goal instead of a regular prompt', async () => {
    enableGoalRuntimeCommand();
    mocks.stream.threadId = 'thread-1';
    const adapter = createGoalAdapter();

    renderChat({ goal: adapter });

    await waitFor(() =>
      expect(screen.getByTestId('goal-command-available')).toHaveTextContent(
        'goal-ready',
      ),
    );

    fireEvent.click(screen.getByTestId('goal-command'));
    setComposerText(screen.getByRole('textbox'), 'find the top AI repos');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() =>
      expect(adapter.setGoal).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: 'thread-1',
          objective: 'find the top AI repos',
        }),
      ),
    );
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));

    expect(mocks.stream.submit.mock.calls[0][0].input).toMatchObject({
      input: 'Continue working toward the active goal.',
      goalRun: true,
    });
    expect(mocks.stream.submit.mock.calls[0][0].input.input).not.toBe(
      'find the top AI repos',
    );
    expect(getSubmittedOptimisticMessages()).toEqual([
      expect.objectContaining({
        type: 'human',
        content: 'find the top AI repos',
        submittedInput: 'find the top AI repos',
      }),
    ]);
    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-off');
    expect(screen.getByRole('textbox').textContent).toBe('');
  });

  it('submits goal mode input as a goal before a thread exists', async () => {
    enableGoalRuntimeCommand();
    const adapter = createGoalAdapter();

    renderChat({ goal: adapter });

    await waitFor(() =>
      expect(screen.getByTestId('goal-command-available')).toHaveTextContent(
        'goal-ready',
      ),
    );

    fireEvent.click(screen.getByTestId('goal-command'));
    setComposerText(screen.getByRole('textbox'), 'find the top AI repos');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() =>
      expect(adapter.setGoal).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: null,
          objective: 'find the top AI repos',
        }),
      ),
    );
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));

    expect(mocks.stream.reset).toHaveBeenCalledWith('thread-1', []);
    expect(mocks.stream.submit.mock.calls[0][0].input).toMatchObject({
      input: 'Continue working toward the active goal.',
      goalRun: true,
    });
    expect(mocks.stream.submit.mock.calls[0][1]).toMatchObject({
      threadId: 'thread-1',
      joinExistingThread: true,
    });
    expect(mocks.stream.submit.mock.calls[0][0].input.input).not.toBe(
      'find the top AI repos',
    );
    expect(getSubmittedOptimisticMessages()).toEqual([
      expect.objectContaining({
        type: 'human',
        content: 'find the top AI repos',
        submittedInput: 'find the top AI repos',
      }),
    ]);
    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-off');
    expect(screen.getByRole('textbox').textContent).toBe('');
  });

  it('submits goal mode input as a goal when pressing Enter', async () => {
    enableGoalRuntimeCommand();
    mocks.stream.threadId = 'thread-1';
    const adapter = createGoalAdapter();

    renderChat({ goal: adapter });

    await waitFor(() =>
      expect(screen.getByTestId('goal-command-available')).toHaveTextContent(
        'goal-ready',
      ),
    );

    fireEvent.click(screen.getByTestId('goal-command'));
    setComposerText(screen.getByRole('textbox'), 'find the top AI repos');
    fireEvent.keyDown(screen.getByRole('textbox'), {
      key: 'Enter',
      code: 'Enter',
    });

    await waitFor(() =>
      expect(adapter.setGoal).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: 'thread-1',
          objective: 'find the top AI repos',
        }),
      ),
    );
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));

    expect(mocks.stream.submit.mock.calls[0][0].input).toMatchObject({
      input: 'Continue working toward the active goal.',
      goalRun: true,
    });
    expect(mocks.stream.submit.mock.calls[0][0].input.input).not.toBe(
      'find the top AI repos',
    );
    expect(getSubmittedOptimisticMessages()).toEqual([
      expect.objectContaining({
        type: 'human',
        content: 'find the top AI repos',
        submittedInput: 'find the top AI repos',
      }),
    ]);
  });

  it('keeps the goal switch as input mode without showing an existing goal summary', async () => {
    enableGoalRuntimeCommand();
    mocks.stream.threadId = 'thread-1';
    const activeGoal: ThreadGoal = {
      id: 'goal-1',
      threadId: 'thread-1',
      objective: 'ship the feature',
      status: 'active',
      tokensUsed: 0,
      elapsedSeconds: 0,
      continuationCount: 0,
    };
    const adapter = createGoalAdapter({
      getGoal: vi.fn(async () => activeGoal),
    });

    renderChat({ goal: adapter });

    await waitFor(() => expect(adapter.getGoal).toHaveBeenCalled());
    expect(screen.queryByText('ship the feature')).toBeNull();

    fireEvent.click(screen.getByTestId('goal-command'));

    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-on');
    expect(screen.queryByText('ship the feature')).toBeNull();

    fireEvent.click(screen.getByTestId('goal-command'));

    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-off');
    expect(screen.queryByText('ship the feature')).toBeNull();
  });

  it('hides the goal status when the stream marks the goal complete', async () => {
    enableGoalRuntimeCommand();
    mocks.stream.threadId = 'thread-1';
    const adapter = createGoalAdapter();
    const options = { goal: adapter };
    const view = renderChat(options);

    await waitFor(() =>
      expect(screen.getByTestId('goal-command-available')).toHaveTextContent(
        'goal-ready',
      ),
    );

    fireEvent.click(screen.getByTestId('goal-command'));
    setComposerText(screen.getByRole('textbox'), 'find the top AI repos');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() =>
      expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-off'),
    );

    (mocks.stream as { threadGoal?: ThreadGoal | null }).threadGoal = {
      id: 'goal-1',
      threadId: 'thread-1',
      objective: 'find the top AI repos',
      status: 'complete',
      tokensUsed: 0,
      elapsedSeconds: 0,
      continuationCount: 0,
    };
    mocks.stream.isLoading = false;

    view.rerender(
      <Chat
        clientSecret="secret"
        options={{
          ...baseChatOptions,
          ...options,
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-off'),
    );
    expect(screen.queryByText('chat.goal.status.complete')).toBeNull();
  });

  it('keeps the active goal card while the goal run is loading and hides it when loading ends', async () => {
    enableGoalRuntimeCommand();
    mocks.stream.threadId = 'thread-1';
    const activeGoal: ThreadGoal = {
      id: 'goal-1',
      threadId: 'thread-1',
      objective: 'find the top AI repos',
      status: 'active',
      tokensUsed: 0,
      elapsedSeconds: 0,
      continuationCount: 0,
    };
    const adapter = createGoalAdapter({
      getGoal: vi.fn(async () => activeGoal),
    });
    const options = { goal: adapter };
    const view = renderChat(options);

    await waitFor(() =>
      expect(screen.getByTestId('goal-command-available')).toHaveTextContent(
        'goal-ready',
      ),
    );

    fireEvent.click(screen.getByTestId('goal-command'));
    setComposerText(screen.getByRole('textbox'), 'find the top AI repos');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() =>
      expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-off'),
    );

    (mocks.stream as { threadGoal?: ThreadGoal | null }).threadGoal =
      activeGoal;
    mocks.stream.isLoading = true;

    view.rerender(
      <Chat
        clientSecret="secret"
        options={{
          ...baseChatOptions,
          ...options,
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('find the top AI repos')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-off');

    mocks.stream.isLoading = false;

    view.rerender(
      <Chat
        clientSecret="secret"
        options={{
          ...baseChatOptions,
          ...options,
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.queryByText('find the top AI repos')).toBeNull(),
    );
    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-off');
  });

  it('allows goal mode to be enabled again after a previous goal completes', async () => {
    enableGoalRuntimeCommand();
    mocks.stream.threadId = 'thread-1';
    const completedGoal: ThreadGoal = {
      id: 'goal-1',
      threadId: 'thread-1',
      objective: 'find the top AI repos',
      status: 'complete',
      tokensUsed: 0,
      elapsedSeconds: 0,
      continuationCount: 0,
    };
    const adapter = createGoalAdapter({
      getGoal: vi.fn(async () => completedGoal),
    });

    renderChat({ goal: adapter });

    await waitFor(() => expect(adapter.getGoal).toHaveBeenCalled());
    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-off');
    expect(screen.queryByText('chat.goal.status.complete')).toBeNull();

    fireEvent.click(screen.getByTestId('goal-command'));

    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-on');
    expect(screen.queryByText('chat.goal.status.complete')).toBeNull();

    setComposerText(screen.getByRole('textbox'), 'ship the next goal');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() =>
      expect(adapter.setGoal).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: 'thread-1',
          objective: 'ship the next goal',
        }),
      ),
    );
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
  });
});
