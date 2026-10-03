import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mocks, renderChat, setupChatTest } from '../testing/chat-fixture';

describe('Chat interruption presentation', () => {
  setupChatTest();

  it('does not promise automatic continuation for a cancelled conversation', async () => {
    mocks.stream.threadId = 'thread-1';
    mocks.stream.isThreadInterrupted = true;
    mocks.stream.messages = [{ id: 'ai', type: 'ai', content: 'Saved reply' }];
    const { container } = renderChat();
    await waitFor(() =>
      expect(
        container.querySelector('[data-slot="chatkit-message-list"]'),
      ).not.toBeNull(),
    );
    expect(screen.queryByText('thread.interrupted')).not.toBeInTheDocument();
    expect(
      screen.queryByText('thread.waitingForInput'),
    ).not.toBeInTheDocument();
  });

  it('shows a user action requirement only for an actual pending approval', async () => {
    mocks.stream.threadId = 'thread-1';
    mocks.stream.isThreadInterrupted = true;
    mocks.stream.pendingHITLRequest = {
      id: 'approval-1',
      executionId: 'run-1',
      createdAt: Date.now(),
      request: {
        actionRequests: [{ name: 'delete_file', args: {} }],
        reviewConfigs: [
          {
            actionName: 'delete_file',
            allowedDecisions: ['approve', 'reject'],
          },
        ],
      },
    };
    renderChat();
    await waitFor(() =>
      expect(screen.getByText('thread.waitingForInput')).toBeVisible(),
    );
    expect(screen.queryByText('thread.interrupted')).not.toBeInTheDocument();
    expect(mocks.stream.submitHITLDecision).not.toHaveBeenCalled();
  });

  it('does not present ordinary long-running work as suspended', async () => {
    mocks.stream.threadId = 'thread-1';
    mocks.stream.isLoading = true;
    mocks.stream.messages = [
      { id: 'ai', type: 'ai', content: 'Checking task status' },
    ];
    const { container } = renderChat();
    await waitFor(() =>
      expect(
        container.querySelector('[data-slot="chatkit-message-list"]'),
      ).not.toBeNull(),
    );
    expect(screen.queryByText('thread.interrupted')).not.toBeInTheDocument();
    expect(
      screen.queryByText('thread.waitingForInput'),
    ).not.toBeInTheDocument();
  });
});
