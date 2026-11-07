import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { mocks, renderChat, setupChatTest } from './chat/testing/chat-fixture';

setupChatTest();

async function openMoreMenu() {
  fireEvent.keyDown(screen.getByRole('button', { name: 'chat.moreActions' }), {
    key: 'Enter',
  });
  return screen.findByRole('menu');
}

it.each(['connected', 'reconnecting'] as const)(
  'terminates from More without submitting a message while %s',
  async (connectionState) => {
    mocks.stream.threadId = 'thread-1';
    mocks.stream.conversationId = 'conversation-1';
    mocks.stream.activeRunId = 'run-1';
    mocks.stream.isLoading = true;
    mocks.stream.connectionState = connectionState;
    mocks.stream.stop.mockReset().mockResolvedValue(undefined);
    renderChat();
    expect(
      screen.queryByRole('button', { name: 'threadControl.terminate' }),
    ).toBeNull();
    await openMoreMenu();
    const end = await screen.findByRole('menuitem', {
      name: 'threadControl.terminate',
    });
    fireEvent.click(end);
    await waitFor(() =>
      expect(mocks.stream.stop).toHaveBeenCalledWith('run-1'),
    );
    expect(mocks.stream.stop).toHaveBeenCalledTimes(1);
    expect(mocks.stream.submit).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'chat.moreActions' }),
      ).toHaveFocus(),
    );
    await openMoreMenu();
    expect(
      screen.queryByRole('menuitem', { name: 'threadControl.terminate' }),
    ).toBeNull();
  },
);

it('does not expose termination for an idle conversation', async () => {
  renderChat();
  await openMoreMenu();
  expect(
    screen.queryByRole('menuitem', { name: 'threadControl.terminate' }),
  ).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'threadControl.terminate' }),
  ).toBeNull();
});

it('keeps termination available when other optional menu items are disabled', async () => {
  mocks.stream.threadId = 'thread-1';
  mocks.stream.activeRunId = 'run-1';
  mocks.stream.isLoading = true;
  renderChat({ pet: { enabled: false }, history: { enabled: false } });
  await openMoreMenu();
  expect(
    screen.getByRole('menuitem', { name: 'threadControl.terminate' }),
  ).toBeVisible();
});

it('retains the composer fallback for embeds without a header', async () => {
  mocks.stream.threadId = 'thread-1';
  mocks.stream.activeRunId = 'run-1';
  mocks.stream.isLoading = true;
  renderChat({ header: { enabled: false } });
  expect(
    await screen.findByRole('button', { name: 'threadControl.terminate' }),
  ).toBeVisible();
  expect(screen.queryByRole('button', { name: 'chat.moreActions' })).toBeNull();
});
