import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatFileChange, MessageFileChangeStats } from '@xpert-ai/chatkit-types';
import { FileChangeCard } from './FileChangeCard';

const changes: ChatFileChange[] = Array.from({ length: 6 }, (_, n) => ({
  id: `c${n}`, title: `file${n}.txt`, workspacePath: `long/directory/file${n}.txt`, operation: 'modified', coverage: 'observed',
  resource: { type: 'file_change', first: { artifactId: `a${n}`, artifactVersionId: 'first' }, last: { artifactId: `a${n}`, artifactVersionId: 'last' } },
}));
const result: MessageFileChangeStats = { messageId: 'm', items: changes.map((change, i) => ({ workspacePath: change.workspacePath, resource: change.resource, stats: i < 2 ? { status: 'ready', added: i + 1, removed: 1 } : { status: 'unavailable' } })) };

describe('file change card', () => {
  it('previews five files, reviews the full fixed message range, and opens individual rows', () => {
    const open = vi.fn();
    const { container } = render(<FileChangeCard changes={changes} messageId="m" onOpenResource={open} />);
    expect(container.querySelectorAll('[data-slot="file-change-rows"] button')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: /^Review$|^审查$|^审阅$/ }));
    expect(open.mock.calls[0][0]).toEqual({ type: 'file_change_set', messageId: 'm', changes: changes.map(({ workspacePath, resource }) => ({ workspacePath, resource })) });
    fireEvent.click(screen.getByRole('button', { name: /long\/directory\/file0.txt/ }));
    expect(open.mock.calls[1][0]).toEqual(changes[0].resource);
    fireEvent.click(screen.getByRole('button', { name: /Show all|展开全部/ }));
    expect(container.querySelectorAll('[data-slot="file-change-rows"] button')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: /Hide files|收起文件/ }));
    expect(container.querySelector('[data-slot="file-change-rows"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Show files|展开文件/ }));
    expect(container.querySelectorAll('[data-slot="file-change-rows"] button')).toHaveLength(5);
    expect(screen.queryByRole('button', { name: /Undo|撤销/ })).toBeNull();
  });
  it('loads statistics through the SDK after streaming; sums known text and never invents binary zeros', async () => {
    const getMessageFileChangeStats = vi.fn().mockResolvedValue(result);
    const props = { changes, messageId: 'm', conversationId: 'conversation', client: { conversations: { getMessageFileChangeStats } }, onOpenResource: vi.fn() };
    const { container, rerender } = render(<FileChangeCard {...props} isLoading />);
    expect(getMessageFileChangeStats).not.toHaveBeenCalled();
    rerender(<FileChangeCard {...props} isLoading={false} />);
    await waitFor(() => expect(container.querySelector('header [data-lines-added="3"]')).toBeTruthy());
    expect(container.querySelector('header [data-lines-removed="2"]')).toBeTruthy();
    const binary = screen.getByRole('button', { name: /long\/directory\/file2.txt/ });
    expect(binary.querySelector('[data-lines-added]')).toBeNull();
    expect(getMessageFileChangeStats).toHaveBeenCalledWith('conversation', 'm', { signal: expect.any(AbortSignal) });
    const changed = changes.map(c => ({ ...c, resource: c.resource && { ...c.resource, last: { ...c.resource.last, artifactVersionId: 'new' } } }));
    rerender(<FileChangeCard {...props} changes={changed} />);
    await waitFor(() => expect(getMessageFileChangeStats).toHaveBeenCalledTimes(2));
    expect(container.querySelector('header [data-lines-added]')).toBeNull();
  });
  it('does not offer review for legacy files without snapshots', () => {
    render(<FileChangeCard changes={[{ ...changes[0], resource: undefined, coverage: 'legacy' }]} messageId="m" onOpenResource={vi.fn()} />);
    for (const button of screen.getAllByRole('button').filter(b => !b.hasAttribute('aria-expanded'))) expect(button).toBeDisabled();
  });
});
