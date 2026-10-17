import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ChatKitImageReference,
  ChatKitTheme,
} from '@xpert-ai/chatkit-types';
import { initI18n } from '../../i18n';
import { ThemeProvider } from '../../providers/Theme';
import { MessageList } from '../thread/MessageList';
import { ReferenceChip } from './ReferenceChip';

const reference: ChatKitImageReference = {
  type: 'image',
  id: 'image',
  fileId: 'file',
  name: 'image.png',
  text: 'Pasted image',
  url: '/image.png',
  mimeType: 'image/png',
  width: 914,
  height: 460,
  size: 174080,
};
beforeEach(async () => {
  await initI18n().changeLanguage('en-US');
});

describe('image reference thumbnails', () => {
  it('shows the thumbnail and removes the reference without submitting or opening its preview', () => {
    const remove = vi.fn();
    const submit = vi.fn((event) => event.preventDefault());
    render(
      <form onSubmit={submit}>
        <ReferenceChip
          reference={reference}
          variant="composer"
          onRemove={remove}
          removeLabel="Remove image"
        />
      </form>,
    );
    expect(screen.getByRole('img', { name: 'image.png' })).toHaveAttribute(
      'src',
      reference.url,
    );
    expect(
      screen.getByRole('button', { name: 'Open image.png' }).parentElement
        ?.title,
    ).toContain('914x460');
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));
    expect(remove).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the existing image viewer and returns focus after Escape', async () => {
    render(
      <ThemeProvider>
        <ReferenceChip reference={reference} variant="composer" />
      </ThemeProvider>,
    );
    const trigger = screen.getByRole('button', { name: 'Open image.png' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'image.png' });
    expect(within(dialog).getByRole('img')).toHaveAttribute(
      'src',
      reference.url,
    );
    expect(
      within(dialog).getByRole('button', { name: 'Zoom in' }),
    ).toBeVisible();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('uses thumbnails in sent messages without changing reference content or showing duplicate attachments', () => {
    render(
      <ThemeProvider>
        <MessageList
          messages={[
            {
              id: 'human',
              type: 'human',
              content: 'Look at this',
              references: [reference],
              attachments: [{ id: 'file', originalName: 'image.png' }],
            },
          ]}
        />
      </ThemeProvider>,
    );
    expect(screen.getAllByRole('img', { name: 'image.png' })).toHaveLength(1);
    expect(screen.getByText('Look at this')).toBeVisible();
    expect(screen.queryByText('image.png')).toBeNull();
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
  });

  it('retains file information when an image has no URL', () => {
    render(
      <ReferenceChip
        reference={{ ...reference, url: undefined }}
        variant="composer"
      />,
    );
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('image.png')).toBeVisible();
    expect(screen.getByText(/image\/png/)).toBeVisible();
  });

  it('keeps failed images removable and retries when the source changes', () => {
    const remove = vi.fn();
    const { rerender } = render(
      <ReferenceChip
        reference={reference}
        variant="composer"
        onRemove={remove}
        removeLabel="Remove image"
      />,
    );
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByText('Preview unavailable')).toBeVisible();
    expect(screen.getByText('image.png')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Open image.png' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));
    expect(remove).toHaveBeenCalledOnce();
    rerender(
      <ReferenceChip
        reference={{ ...reference, url: '/replacement.png' }}
        variant="composer"
      />,
    );
    expect(screen.getByRole('img')).toHaveAttribute('src', '/replacement.png');
    expect(
      screen.getByRole('button', { name: 'Open image.png' }),
    ).toBeEnabled();
  });

  it('updates thumbnail density and portal theme while the preview is open', async () => {
    const tree = (theme: ChatKitTheme) => (
      <ThemeProvider theme={theme}>
        <ReferenceChip reference={reference} variant="composer" />
      </ThemeProvider>
    );
    const { rerender } = render(
      tree({ density: 'compact', radius: 'sharp', colorScheme: 'dark' }),
    );
    const trigger = screen.getByRole('button', { name: 'Open image.png' });
    expect(trigger).toHaveStyle({ width: '96px', height: '72px' });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveStyle({
      '--chat-panel-radius': '0px',
      '--chat-density-scale': '0.75',
    });
    expect(within(dialog).getByRole('button', { name: 'Zoom in' })).toHaveStyle(
      { height: '24px' },
    );
    rerender(
      tree({ density: 'spacious', radius: 'round', colorScheme: 'light' }),
    );
    expect(trigger).toHaveStyle({ width: '160px', height: '120px' });
    expect(dialog).toHaveStyle({
      '--chat-density-scale': '1.25',
      '--chat-panel-radius': 'calc(var(--radius, 0.625rem) + 4px)',
    });
    expect(within(dialog).getByRole('button', { name: 'Zoom in' })).toHaveStyle(
      { height: '40px' },
    );
  });
});
