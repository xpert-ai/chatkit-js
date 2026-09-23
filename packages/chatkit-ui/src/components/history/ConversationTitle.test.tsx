import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConversationTitle } from './ConversationTitle';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({ t: (key: string) => key }),
}));

const rename = () =>
  screen.getByRole('button', { name: 'chat.conversationTitle.rename' });
const input = () =>
  screen.getByRole('textbox', { name: 'chat.conversationTitle.label' });

function edit(title: string) {
  fireEvent.click(rename());
  fireEvent.change(input(), { target: { value: title } });
}

describe('ConversationTitle', () => {
  it('selects the title and saves trimmed text on Enter', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ConversationTitle title="Original" onSave={onSave} />);
    fireEvent.click(rename());
    expect(input()).toHaveFocus();
    expect(input()).toHaveProperty('selectionStart', 0);
    expect(input()).toHaveProperty('selectionEnd', 8);
    fireEvent.change(input(), {
      target: { value: '  Renamed conversation  ' },
    });
    fireEvent.keyDown(input(), { key: 'Enter' });
    await waitFor(() => expect(rename()).toHaveFocus());
    expect(onSave).toHaveBeenCalledExactlyOnceWith('Renamed conversation');
  });

  it.each(['Escape', 'button'])(
    'cancels with %s without persisting',
    (action) => {
      const onSave = vi.fn();
      render(<ConversationTitle title="Original" onSave={onSave} />);
      edit('Discard this');
      if (action === 'Escape') fireEvent.keyDown(input(), { key: 'Escape' });
      else
        fireEvent.click(
          screen.getByRole('button', { name: 'chat.conversationTitle.cancel' }),
        );
      expect(rename()).toHaveTextContent('Original');
      expect(onSave).not.toHaveBeenCalled();
    },
  );

  it('saves on blur outside the editor but not while focusing its controls', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ConversationTitle title="Original" onSave={onSave} />);
    edit('Changed');
    const saveButton = screen.getByRole('button', {
      name: 'chat.conversationTitle.save',
    });
    fireEvent.blur(input(), { relatedTarget: saveButton });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.blur(saveButton, { relatedTarget: document.body });
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledExactlyOnceWith('Changed'),
    );
    expect(rename()).not.toHaveFocus();
  });

  it('rejects blank titles and skips unchanged titles', () => {
    const onSave = vi.fn();
    render(<ConversationTitle title="Original" onSave={onSave} />);
    edit('   ');
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'chat.conversationTitle.required',
    );
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(input(), { target: { value: ' Original ' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(rename()).toHaveTextContent('Original');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps a failed draft for retry', async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    render(<ConversationTitle title="Original" onSave={onSave} />);
    edit('Keep my draft');
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'chat.conversationTitle.saveFailed',
    );
    expect(input()).toHaveValue('Keep my draft');
    fireEvent.click(
      screen.getByRole('button', { name: 'chat.conversationTitle.save' }),
    );
    await waitFor(() => expect(rename()).toBeVisible());
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('deduplicates Enter, blur and save while awaiting persistence', async () => {
    let resolve!: () => void;
    const onSave = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    render(<ConversationTitle title="Original" onSave={onSave} />);
    edit('Changed');
    fireEvent.keyDown(input(), { key: 'Enter' });
    fireEvent.keyDown(input(), { key: 'Enter' });
    fireEvent.blur(input());
    expect(input()).toHaveAttribute('readonly');
    expect(
      screen.getByRole('button', { name: 'chat.conversationTitle.save' }),
    ).toBeDisabled();
    expect(onSave).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
  });

  it('does not save or cancel when Enter or Escape confirms IME composition', () => {
    const onSave = vi.fn();
    render(<ConversationTitle title="Original" onSave={onSave} />);
    edit('中文标题');
    fireEvent.compositionStart(input());
    fireEvent.keyDown(input(), { key: 'Enter' });
    fireEvent.keyDown(input(), { key: 'Escape' });
    fireEvent.compositionEnd(input());
    expect(input()).toHaveValue('中文标题');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('discards the editor on navigation and ignores a late completion', async () => {
    let resolve!: () => void;
    const onSave = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const { rerender } = render(
      <ConversationTitle key="first" title="First" onSave={onSave} />,
    );
    edit('Renamed first');
    fireEvent.keyDown(input(), { key: 'Enter' });
    rerender(<ConversationTitle key="second" title="Second" onSave={onSave} />);
    edit('Second draft');
    await act(async () => resolve());
    expect(input()).toHaveValue('Second draft');
    expect(input()).toHaveFocus();
  });

  it('shows noneditable status text without a save callback', () => {
    render(<ConversationTitle title="Online" />);
    expect(screen.getByText('Online')).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
