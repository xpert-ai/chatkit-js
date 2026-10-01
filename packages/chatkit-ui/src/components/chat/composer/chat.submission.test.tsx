import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  mocks,
  renderChat,
  setComposerText,
  setupChatTest,
} from '../testing/chat-fixture';

describe('Chat plan mode and submission', () => {
  setupChatTest();
  it('omits planMode from regular sends by default', async () => {
    renderChat();

    const composerShell = document.querySelector(
      '[data-slot="composer-input-shell"]',
    );
    expect(composerShell).toHaveAttribute('data-layout', 'stacked');

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, 'hello');
    expect(composerShell).toHaveAttribute('data-layout', 'stacked');

    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          input: 'hello',
        },
      }),
      expect.any(Object),
    );
    expect(mocks.stream.submit.mock.calls[0][0].input).not.toHaveProperty(
      'planMode',
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('queues composer sends by default while a run is active', async () => {
    mocks.stream.isLoading = true;
    renderChat();

    setComposerText(screen.getByRole('textbox'), 'follow up');

    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.submit.mock.calls[0][0]).toMatchObject({
      input: {
        input: 'follow up',
      },
    });
    expect(mocks.stream.submit.mock.calls[0][1]).toMatchObject({
      followUpMode: 'queue',
    });
  });

  it('shows active stream errors in the thread error area', async () => {
    mocks.stream.error = new Error(
      'Invalid node name "sandbox_service_stop" in Send packet',
    );

    renderChat();

    await waitFor(() => {
      expect(
        screen.getAllByText(
          'Invalid node name "sandbox_service_stop" in Send packet',
        ),
      ).toHaveLength(1);
    });
  });

  it('adds planMode to input and state.human when enabled', async () => {
    renderChat();

    const composerShell = document.querySelector(
      '[data-slot="composer-input-shell"]',
    );
    expect(composerShell).toHaveAttribute('data-layout', 'stacked');

    fireEvent.click(screen.getByTestId('plan-mode-toggle'));
    expect(composerShell).toHaveAttribute('data-layout', 'stacked');

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, 'plan this');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          input: 'plan this',
          planMode: true,
        },
        state: {
          human: {
            input: 'plan this',
            planMode: true,
          },
        },
      }),
      expect.any(Object),
    );
  });
});
