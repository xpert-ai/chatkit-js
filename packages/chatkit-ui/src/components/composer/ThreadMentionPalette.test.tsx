import * as React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Client } from '@xpert-ai/xpert-sdk';
import {
  ThreadMentionPalette,
  type ThreadMentionPaletteHandle,
} from './ThreadMentionPalette';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({ t: (key: string) => key }),
}));
const results = [
  { id: 'self', threadId: 'current', title: 'Current' },
  { id: 'selected', threadId: 'already', title: 'Selected' },
  { id: 'one', threadId: 'one', title: 'Duplicate title' },
  { id: 'two', threadId: 'two', title: 'Duplicate title' },
];

describe('ThreadMentionPalette', () => {
  it('recovers from a failed search and renders hostile titles as plain text', async () => {
    const title = '<img src=x onerror=alert(1)>';
    const search = vi.fn().mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValue({
      items: [{ id: 'source', threadId: 'source-thread', title }],
    });
    const props = { client: { conversations: { search } } as unknown as Client, assistantId: 'assistant', projectId: null,
      selectedThreadIds: new Set<string>(), onSelect: vi.fn() };
    const { rerender } = render(<ThreadMentionPalette {...props} query="first" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('composer.threadMentions.error');
    rerender(<ThreadMentionPalette {...props} query="next" />);
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    fireEvent.click(screen.getByRole('option'));
    expect(props.onSelect).toHaveBeenCalledWith(expect.objectContaining({ label: title, threadId: 'source-thread' }));
  });

  it('handles empty results, unavailable clients and unmount cancellation without selection', async () => {
    const search = vi.fn().mockResolvedValue({ items: [] });
    const onSelect = vi.fn();
    const ref = React.createRef<ThreadMentionPaletteHandle>();
    const props = { assistantId: 'assistant', projectId: null, query: '', selectedThreadIds: new Set<string>(), onSelect };
    const { rerender, unmount } = render(<ThreadMentionPalette ref={ref} {...props} client={null} />);
    expect(search).not.toHaveBeenCalled();
    expect(ref.current?.selectActive()).toBe(false);
    rerender(<ThreadMentionPalette ref={ref} {...props} client={{ conversations: { search } } as unknown as Client} />);
    await waitFor(() => expect(search).toHaveBeenCalledOnce());
    expect(await screen.findByText('composer.threadMentions.empty')).toBeInTheDocument();
    act(() => ref.current?.moveActive(-1));
    expect(ref.current?.selectActive()).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
    const signal: AbortSignal = search.mock.calls[0][1].signal;
    unmount();
    expect(signal.aborted).toBe(true);
  });
  it('searches through SDK, excludes current/selected threads and selects exact identity with the keyboard', async () => {
    const search = vi.fn().mockResolvedValue({ items: results });
    const client = { conversations: { search } } as unknown as Client;
    const ref = React.createRef<ThreadMentionPaletteHandle>();
    const onSelect = vi.fn();
    render(
      <ThreadMentionPalette
        ref={ref}
        client={client}
        assistantId="assistant"
        projectId="project"
        threadId="current"
        query="Duplicate"
        selectedThreadIds={new Set(['already'])}
        onSelect={onSelect}
      />,
    );
    await screen.findAllByRole('option');
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.queryByText('Current')).not.toBeInTheDocument();
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'Duplicate',
        where: { xpertId: 'assistant', projectId: 'project' },
      }),
      { signal: expect.any(AbortSignal) },
    );
    act(() => ref.current?.moveActive(1));
    act(() => ref.current?.selectActive());
    expect(onSelect).toHaveBeenCalledWith({
      type: 'thread',
      conversationId: 'two',
      threadId: 'two',
      label: 'Duplicate title',
    });
  });

  it('aborts obsolete searches and ignores late responses', async () => {
    let resolveFirst: ((value: { items: typeof results }) => void) | undefined;
    const search = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue({
        items: [{ id: 'new', threadId: 'new', title: 'Latest result' }],
      });
    const props = {
      client: { conversations: { search } } as unknown as Client,
      assistantId: 'assistant',
      projectId: null,
      selectedThreadIds: new Set<string>(),
      onSelect: vi.fn(),
    };
    const { rerender } = render(
      <ThreadMentionPalette {...props} query="old" />,
    );
    await waitFor(() => expect(search).toHaveBeenCalledOnce());
    const signal: AbortSignal = search.mock.calls[0][1].signal;
    rerender(<ThreadMentionPalette {...props} query="new" />);
    expect(signal.aborted).toBe(true);
    await screen.findByText('Latest result');
    await act(async () => resolveFirst?.({ items: results }));
    expect(screen.queryByText('Duplicate title')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option'));
    expect(props.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: 'new' }),
    );
  });
});
