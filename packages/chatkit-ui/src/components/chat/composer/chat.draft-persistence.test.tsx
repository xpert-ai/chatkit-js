import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { StreamSubmitOptions } from '../../../providers/stream/types';
import { UnconfirmedRunError } from '../../../providers/stream/transport/errors';
import {
  mocks,
  renderChat,
  setComposerText,
  setupChatTest,
} from '../testing/chat-fixture';

describe('Chat persistent submissions', () => {
  setupChatTest();
  beforeEach(() => {
    localStorage.clear();
    mocks.stream.threadId = 'thread';
    mocks.stream.conversationId = 'conversation';
  });

  it('restores multiline text after remount without extra host configuration', () => {
    const first = renderChat();
    setComposerText(screen.getByRole('textbox'), 'Line one\n\n第二行');
    first.unmount();
    renderChat();
    expect(screen.getByRole('textbox').textContent).toBe('Line one\n\n第二行');
    expect(mocks.stream.submit).not.toHaveBeenCalled();
  });

  it('clears storage on server acknowledgement while preserving new input', async () => {
    let accepted!: () => void;
    let finish!: () => void;
    mocks.stream.submit.mockImplementationOnce(
      (_input, submitOptions: StreamSubmitOptions) => {
        if (!submitOptions.onRunAccepted)
          throw new Error('Expected a server acknowledgement callback');
        accepted = submitOptions.onRunAccepted;
        return new Promise<void>((resolve) => {
          finish = resolve;
        });
      },
    );
    const first = renderChat();
    setComposerText(screen.getByRole('textbox'), 'old');
    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    setComposerText(screen.getByRole('textbox'), 'new');
    act(() => accepted());
    expect(screen.getByRole('textbox').textContent).toBe('new');
    first.unmount();
    renderChat();
    expect(screen.getByRole('textbox').textContent).toBe('new');
    await act(async () => finish());
  });

  it.each([false, true])(
    'keeps a failed send recoverable (unconfirmed: %s)',
    async (unconfirmed) => {
      mocks.stream.submit.mockRejectedValueOnce(
        unconfirmed
          ? new UnconfirmedRunError(new Error('offline'))
          : new Error('Rejected'),
      );
      const first = renderChat();
      setComposerText(screen.getByRole('textbox'), 'recover me');
      fireEvent.click(screen.getByRole('button', { name: 'send' }));
      await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledOnce());
      await act(async () => {});
      if (unconfirmed) expect(screen.getByRole('textbox').textContent).toBe('');
      else expect(screen.getByRole('textbox').textContent).toBe('recover me');
      first.unmount();
      renderChat();
      expect(screen.getByRole('textbox').textContent).toBe('recover me');
      expect(mocks.stream.submit).toHaveBeenCalledOnce();
    },
  );

  it('does not treat a local queue insertion as durable acceptance', async () => {
    mocks.stream.isLoading = true;
    const first = renderChat();
    setComposerText(screen.getByRole('textbox'), 'queued');
    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    await act(async () => {});
    expect(mocks.stream.submit.mock.calls[0][1]).toMatchObject({
      followUpMode: 'queue',
    });
    first.unmount();
    renderChat();
    expect(screen.getByRole('textbox').textContent).toBe('queued');
  });
});
