import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import {
  mocks,
  renderChat,
  setupChatTest,
} from './chat/testing/chat-fixture';

setupChatTest();

it('exposes termination in the actual composer without submitting another message', async () => {
  mocks.stream.threadId = 'thread-1';
  mocks.stream.activeRunId = 'run-1';
  mocks.stream.isLoading = true;
  mocks.stream.stop.mockResolvedValue(undefined);
  renderChat();
  const end = await screen.findByRole('button', { name: 'threadControl.terminate' });
  fireEvent.click(end);
  await waitFor(() => expect(mocks.stream.stop).toHaveBeenCalledWith('run-1'));
  expect(mocks.stream.stop).toHaveBeenCalledTimes(1);
  expect(mocks.stream.submit).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole('button', { name: 'threadControl.terminate' })).toBeNull());
});

it('does not expose termination for an idle conversation', async () => {
  renderChat();
  expect(screen.queryByRole('button', { name: 'threadControl.terminate' })).toBeNull();
});
