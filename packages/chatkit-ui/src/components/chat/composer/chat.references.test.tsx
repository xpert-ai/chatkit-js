import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  insertComposerText,
  mocks,
  renderChat,
  setComposerText,
  setupChatTest,
} from '../testing/chat-fixture';

describe('Chat references and composition', () => {
  setupChatTest();
  it('selects a workspace file from the composer footer without replacing the draft', async () => {
    mocks.stream.client.xperts.listWorkspaceFiles.mockResolvedValue([
      {
        filePath: 'Product brief.pdf',
        fullPath: 'briefs/Product brief.pdf',
        fileType: 'pdf',
        hasChildren: false,
        mimeType: 'application/pdf',
        size: 2048,
      },
    ]);
    renderChat();
    setComposerText(screen.getByRole('textbox'), 'Summarize this file');
    fireEvent.click(
      screen.getByRole('button', { name: 'composer.fileMentions.select' }),
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'composer.fileMentions.search' }),
      {
        target: { value: 'brief' },
      },
    );
    fireEvent.keyDown(
      screen.getByRole('textbox', { name: 'composer.fileMentions.search' }),
      { key: 'ArrowDown' },
    );
    await screen.findByRole('button', { name: 'Product brief.pdf' });
    fireEvent.keyDown(
      screen.getByRole('textbox', { name: 'composer.fileMentions.search' }),
      { key: 'Enter' },
    );
    expect(screen.getByRole('textbox')).toHaveTextContent(
      'Summarize this file',
    );
    expect(screen.getByText('Product brief.pdf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledOnce());
    expect(mocks.stream.submit.mock.calls[0][0]).toMatchObject({
      input: {
        input: 'Summarize this file',
        files: [
          expect.objectContaining({
            workspacePath: 'briefs/Product brief.pdf',
            purpose: 'workspace',
          }),
        ],
      },
    });
  });

  it('inserts an inline conversation reference before the first conversation exists', async () => {
    mocks.stream.client.conversations.search.mockResolvedValue({
      items: [
        {
          id: 'conversation-source',
          threadId: 'thread-source',
          title: 'Product research',
        },
      ],
    });
    renderChat();
    setComposerText(screen.getByRole('textbox'), '@prod');
    await screen.findByRole('option', { name: /Product research/ });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(
      screen.getByRole('textbox').querySelector('[data-composer-thread-key]'),
    ).toHaveTextContent('Product research');
    insertComposerText(screen.getByRole('textbox'), 'Summarize it');
    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledOnce());
    expect(mocks.stream.client.conversations.search).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'prod',
        where: { xpertId: 'assistant-1', projectId: null },
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mocks.stream.submit.mock.calls[0][0]).toMatchObject({
      input: {
        input: 'Summarize it',
        references: [
          {
            type: 'thread',
            conversationId: 'conversation-source',
            threadId: 'thread-source',
            label: 'Product research',
          },
        ],
      },
    });
  });

  it('restores an inline thread reference when submission fails and deletes it atomically', async () => {
    let rejectSubmission: ((reason: unknown) => void) | undefined;
    mocks.stream.submit.mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectSubmission = reject;
        }),
    );
    mocks.stream.client.conversations.search.mockResolvedValue({
      items: [
        {
          id: 'conversation-source',
          threadId: 'thread-source',
          title: 'Product research',
        },
      ],
    });
    renderChat();
    setComposerText(screen.getByRole('textbox'), '@prod');
    fireEvent.click(
      await screen.findByRole('option', { name: /Product research/ }),
    );
    insertComposerText(screen.getByRole('textbox'), 'Summarize it');
    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledOnce());
    await act(async () => {
      rejectSubmission?.(new Error('Thread creation failed'));
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(screen.getByRole('textbox')).toHaveTextContent('Summarize it'),
    );
    expect(
      screen.getByRole('textbox').querySelector('[data-composer-thread-key]'),
    ).toHaveTextContent('Product research');
    fireEvent.click(
      screen.getByRole('button', { name: 'composer.threadMentions.remove' }),
    );
    expect(
      screen.getByRole('textbox').querySelector('[data-composer-thread-key]'),
    ).toBeNull();
    expect(screen.getByRole('textbox')).toHaveTextContent('Summarize it');
  });

  it.each(['Enter', ' '])(
    'removes a focused thread reference with %j without submitting the draft',
    async (key) => {
      mocks.stream.client.conversations.search.mockResolvedValue({
        items: [
          {
            id: 'conversation-source',
            threadId: 'thread-source',
            title: 'Referenced history',
          },
        ],
      });
      renderChat();
      setComposerText(screen.getByRole('textbox'), 'Keep this draft @history');
      fireEvent.click(
        await screen.findByRole('option', { name: /Referenced history/ }),
      );
      const remove = screen.getByRole('button', {
        name: 'composer.threadMentions.remove',
      });
      act(() => remove.focus());

      expect(fireEvent.keyDown(remove, { key })).toBe(true);
      expect(mocks.stream.submit).not.toHaveBeenCalled();
      fireEvent.keyUp(remove, { key });
      // jsdom does not synthesize the button's native keyboard click.
      fireEvent.click(remove, { detail: 0 });

      expect(mocks.stream.submit).not.toHaveBeenCalled();
      expect(
        screen.getByRole('textbox').querySelector('[data-composer-thread-key]'),
      ).toBeNull();
      expect(screen.getByRole('textbox')).toHaveTextContent('Keep this draft');
    },
  );

  it('submits a reference-only input and retains it in queued follow-up state', async () => {
    mocks.stream.isLoading = true;
    mocks.stream.client.conversations.search.mockResolvedValue({
      items: [
        {
          id: 'conversation-source',
          threadId: 'thread-source',
          title: 'Referenced history',
        },
      ],
    });
    renderChat();
    setComposerText(screen.getByRole('textbox'), '@history');
    fireEvent.click(
      await screen.findByRole('option', { name: /Referenced history/ }),
    );
    expect(screen.getByRole('button', { name: 'send' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledOnce());
    const [request, options] = mocks.stream.submit.mock.calls[0];
    expect(request.input).toMatchObject({
      input: '',
      references: [expect.objectContaining({ threadId: 'thread-source' })],
    });
    expect(request.state.human.references).toEqual(request.input.references);
    expect(options).toMatchObject({ followUpMode: 'queue' });
  });

  it('does not search or select a thread while Chinese IME composition is active', async () => {
    mocks.stream.client.conversations.search.mockResolvedValue({
      items: [
        {
          id: 'conversation-source',
          threadId: 'thread-source',
          title: '调查错误',
        },
      ],
    });
    renderChat();
    const composer = screen.getByRole('textbox');
    fireEvent.compositionStart(composer);
    setComposerText(composer, '@调查');
    fireEvent.keyDown(composer, { key: 'Enter', isComposing: true });
    expect(mocks.stream.client.conversations.search).not.toHaveBeenCalled();
    expect(mocks.stream.submit).not.toHaveBeenCalled();
    fireEvent.compositionEnd(composer);
    await screen.findByRole('option', { name: /调查错误/ });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(
      screen.queryByRole('listbox', { name: 'composer.threadMentions.title' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveTextContent('@调查');
  });

  it.each(['Backspace', 'Delete'])(
    'removes a thread atomically with %s while preserving adjacent text',
    async (key) => {
      mocks.stream.client.conversations.search.mockResolvedValue({
        items: [
          {
            id: 'conversation-source',
            threadId: 'thread-source',
            title: 'Referenced history',
          },
        ],
      });
      renderChat();
      setComposerText(screen.getByRole('textbox'), 'Before @history');
      fireEvent.click(
        await screen.findByRole('option', { name: /Referenced history/ }),
      );
      const composer = screen.getByRole('textbox');
      const token = composer.querySelector('[data-composer-thread-key]')!;
      const range = document.createRange();
      if (key === 'Backspace') range.setStartAfter(token);
      else range.setStartBefore(token);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      fireEvent.keyDown(composer, { key });
      expect(
        screen.getByRole('textbox').querySelector('[data-composer-thread-key]'),
      ).toBeNull();
      expect(screen.getByRole('textbox')).toHaveTextContent('Before');
    },
  );

  it('keeps the contenteditable node stable during IME composition', async () => {
    renderChat();

    const textbox = screen.getByRole('textbox');
    const send = screen.getByRole('button', { name: 'send' });
    fireEvent.compositionStart(textbox);
    textbox.textContent = 'pin';
    fireEvent.input(textbox, { isComposing: true });
    expect(screen.getByRole('textbox')).toBe(textbox);
    expect(send).toBeDisabled();

    textbox.textContent = '拼';
    fireEvent.compositionEnd(textbox);
    expect(screen.getByRole('textbox')).toBe(textbox);

    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.submit.mock.calls[0][0].input).toEqual({
      input: '拼',
    });
  });
});
