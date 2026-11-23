import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type { Thread } from '@xpert-ai/xpert-sdk';
import { describe, expect, it, vi } from 'vitest';
import { mocks, renderChat, setupChatTest } from '../testing/chat-fixture';

function activeRun() {
  const thread: Thread = {
    thread_id: 'thread-1',
    created_at: '',
    updated_at: '',
    metadata: {},
    values: {},
    interrupts: {},
    status: 'busy',
    runControl: { executionId: 'run-1', state: 'running' },
  };
  mocks.stream.threadId = thread.thread_id;
  mocks.stream.conversationId = 'conversation-1';
  mocks.stream.activeRunId = 'run-1';
  mocks.stream.isLoading = true;
  mocks.stream.client.conversations.listThreads = vi.fn(async () => [thread]);
  mocks.stream.pauseRun.mockImplementation(async () => {
    thread.status = 'paused';
    thread.runControl = {
      executionId: 'run-1',
      state: 'paused',
      pauseId: 'pause-1',
    };
  });
  return thread;
}

describe('composer pause, resume and termination', () => {
  setupChatTest();

  it('pauses with the primary action and resumes the same run from the start action', async () => {
    activeRun();
    renderChat();
    expect(
      screen.queryByRole('button', { name: 'threadControl.stop' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'stop' }));
    await waitFor(() =>
      expect(mocks.stream.pauseRun).toHaveBeenCalledWith('run-1'),
    );
    const resume = await screen.findByRole('button', { name: 'resume' });
    await waitFor(() => expect(resume).not.toBeDisabled());
    const stop = screen.getByRole('button', { name: 'threadControl.stop' });
    expect(
      stop.compareDocumentPosition(resume) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.click(resume);
    await waitFor(() =>
      expect(mocks.stream.resumeRun).toHaveBeenCalledWith('run-1', 'pause-1'),
    );
    expect(mocks.stream.stop).not.toHaveBeenCalled();
    expect(mocks.stream.submit).not.toHaveBeenCalled();
  });

  it('terminates from the left Stop action while pause acknowledgement is pending', async () => {
    activeRun();
    let acknowledgePause: () => void = () => {};
    mocks.stream.pauseRun.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          acknowledgePause = resolve;
        }),
    );
    renderChat();
    fireEvent.click(screen.getByRole('button', { name: 'stop' }));
    expect(
      await screen.findByRole('button', { name: 'resume' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'threadControl.stop' }));
    await waitFor(() =>
      expect(mocks.stream.stop).toHaveBeenCalledWith('run-1'),
    );
    expect(mocks.stream.resumeRun).not.toHaveBeenCalled();
    expect(mocks.stream.submit).not.toHaveBeenCalled();
    await act(async () => acknowledgePause());
  });
});
