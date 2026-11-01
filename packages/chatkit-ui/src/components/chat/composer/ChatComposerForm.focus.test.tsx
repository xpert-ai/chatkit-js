import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatComposerForm } from './ChatComposerForm';
import { useChatDraft } from './useChatDraft';
import {
  createComposerTextParts,
  getComposerSelectionOffset,
  setComposerSelectionOffset,
} from '../../../lib/composer-parts';

afterEach(cleanup);

function composerElement(container: HTMLElement, slot: string) {
  const element = container.querySelector(`[data-slot="${slot}"]`);
  if (!element) throw new Error(`Missing ${slot}`);
  return element;
}

function Composer({
  disabled = false,
  compact = false,
  onRemove = () => undefined,
}: {
  disabled?: boolean;
  compact?: boolean;
  onRemove?: () => void;
}) {
  const draft = useChatDraft();
  return (
    <ChatComposerForm
      compact={compact}
      onSubmit={(event) => event.preventDefault()}
      send={{ disabled: true, sendLabel: 'Send' }}
      editor={{
        inputRef: draft.composerInputRef,
        focus: draft.focusComposerAt,
        disabled,
        placeholder: 'Type a message',
        onInput: (event) =>
          draft.commitComposerParts(
            createComposerTextParts(event.currentTarget.textContent ?? ''),
          ),
        hasInline: true,
        inline: (
          <span>
            <span>Selected skill</span>
            <button type="button" onClick={onRemove}>
              Remove skill
            </button>
          </span>
        ),
      }}
    />
  );
}

describe('shared Composer focus', () => {
  it('preserves a multiline draft and selection when compacting and restoring', async () => {
    const view = render(<Composer />);
    const input = screen.getByRole('textbox');
    input.textContent = 'First line\nSecond line';
    input.focus();
    setComposerSelectionOffset(input, 5);
    fireEvent.input(input);
    view.rerender(<Composer compact />);
    expect(screen.getByRole('textbox')).toBe(input);
    expect(input.textContent).toBe('First line\nSecond line');
    expect(input).toHaveFocus();
    expect(getComposerSelectionOffset(input)).toBe(5);
    view.rerender(<Composer />);
    expect(screen.getByRole('textbox')).toBe(input);
    expect(input.textContent).toBe('First line\nSecond line');
    expect(getComposerSelectionOffset(input)).toBe(5);
  });
  it('keeps the caret after the first character entered following a focus request', async () => {
    const { container } = render(<Composer />);
    const input = screen.getByRole('textbox');
    fireEvent.click(composerElement(container, 'composer-editor-surface'));
    await waitFor(() => expect(input).toHaveFocus());
    input.textContent = '你';
    setComposerSelectionOffset(input, 1);
    fireEvent.input(input);
    expect(getComposerSelectionOffset(input)).toBe(1);
  });
  it.each(['surface', 'body', 'tag'])(
    'focuses the editable input when clicking its %s',
    async (target) => {
      const { container } = render(<Composer />);
      const clicked =
        target === 'tag'
          ? screen.getByText('Selected skill')
          : composerElement(
              container,
              target === 'surface'
                ? 'composer-editor-surface'
                : 'composer-body',
            );
      fireEvent.click(clicked);
      await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus());
      expect(window.getSelection()?.anchorNode).toBe(
        screen.getByRole('textbox'),
      );
    },
  );

  it('does not steal focus from a tag action or a disabled editor', async () => {
    const onRemove = vi.fn();
    const { rerender, container } = render(<Composer onRemove={onRemove} />);
    const button = screen.getByRole('button', { name: 'Remove skill' });
    button.focus();
    fireEvent.click(button);
    expect(onRemove).toHaveBeenCalledOnce();
    expect(button).toHaveFocus();

    rerender(<Composer disabled />);
    fireEvent.click(screen.getByText('Selected skill'));
    fireEvent.click(composerElement(container, 'composer-editor-surface'));
    expect(screen.getByRole('textbox')).not.toHaveFocus();
    expect(screen.getByRole('textbox')).toHaveAttribute(
      'contenteditable',
      'false',
    );
  });
});
