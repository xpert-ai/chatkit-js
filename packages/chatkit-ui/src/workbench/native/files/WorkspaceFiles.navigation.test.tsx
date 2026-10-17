import * as React from 'react';
import { Client } from '@xpert-ai/xpert-sdk';
import type { ChatKitTheme } from '@xpert-ai/chatkit-types';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../../../i18n';
import { ThemeProvider } from '../../../providers/Theme';
import { WorkspaceFiles } from './WorkspaceFiles';

vi.mock('../../../components/code-editor/CodeEditor', () => ({
  default: ({ value }: { value: string }) => <pre>{value}</pre>,
}));

function setup(theme: ChatKitTheme = { colorScheme: 'light' }) {
  const client = new Client({ apiUrl: 'https://example.test/api/ai' });
  const list = vi
    .spyOn(client.workbench, 'listFiles')
    .mockImplementation(async (_scope, path) => {
      if (path === '') return [{ filePath: 'docs', fileType: 'directory' }];
      if (path === 'docs')
        return [
          { filePath: 'nested', fileType: 'directory' },
          { filePath: 'report.xlsx' },
        ];
      if (path === 'docs/nested') return [{ filePath: 'notes.txt' }];
      return [];
    });
  const download = vi
    .spyOn(client.workbench, 'downloadFile')
    .mockResolvedValue(
      new Blob(['Nested file content'], { type: 'text/plain' }),
    );
  const onOpen = vi.fn();
  const onPreview = vi.fn();
  const content = (theme: ChatKitTheme) => (
    <ThemeProvider theme={theme}>
      <WorkspaceFiles
        client={client}
        scope={{ kind: 'assistant', assistantId: 'a1' }}
        onOpen={onOpen}
        onPreview={onPreview}
      />
    </ThemeProvider>
  );
  return {
    ...render(content(theme)),
    content,
    client,
    list,
    download,
    onOpen,
    onPreview,
  };
}
function enter(input: HTMLElement, path: string) {
  fireEvent.change(input, { target: { value: path } });
  fireEvent.keyDown(input, { key: 'Enter' });
}
beforeEach(async () => {
  await initI18n().changeLanguage('en-US');
});

describe('workspace path navigation', () => {
  it('loads unopened ancestors, opens the exact file and reveals a folder with a trailing slash', async () => {
    const { list, onPreview, download } = setup();
    await screen.findByRole('treeitem', { name: 'docs' });
    const search = screen.getByRole('searchbox');
    enter(search, './docs/nested/notes.txt');
    await waitFor(() =>
      expect(onPreview).toHaveBeenCalledWith(
        expect.objectContaining({ filePath: 'docs/nested/notes.txt' }),
      ),
    );
    expect(list.mock.calls.map((call) => call[1])).toContain('docs/nested');
    expect(screen.getByRole('treeitem', { name: 'notes.txt' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(download).toHaveBeenCalledWith(
      expect.anything(),
      'docs/nested/notes.txt',
      expect.anything(),
    );
    expect(search).toHaveValue('');
    enter(search, 'docs/nested/');
    await waitFor(() =>
      expect(screen.getByRole('treeitem', { name: 'nested' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );
    expect(screen.getByRole('treeitem', { name: 'nested' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(onPreview).toHaveBeenLastCalledWith(null);
  });

  it('resolves paths relative to the breadcrumb folder and opens Office files through the existing editor', async () => {
    const { onOpen } = setup();
    await screen.findByRole('treeitem', { name: 'docs' });
    enter(screen.getByRole('searchbox'), 'docs/nested/');
    await screen.findByRole('button', { name: 'nested' });
    fireEvent.click(screen.getByRole('button', { name: 'nested' }));
    const panel = await screen.findByRole('dialog');
    enter(within(panel).getByRole('searchbox'), '../report.xlsx');
    await waitFor(() =>
      expect(onOpen).toHaveBeenCalledWith(
        expect.objectContaining({ filePath: 'docs/report.xlsx' }),
      ),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reports missing targets and rejects paths outside the workspace without a request', async () => {
    const { list, onOpen, onPreview } = setup();
    await screen.findByRole('treeitem', { name: 'docs' });
    const search = screen.getByRole('searchbox');
    for (const invalid of ['../../private', '/tmp/private', 'docs\\private']) {
      const count = list.mock.calls.length;
      enter(search, invalid);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'relative path',
      );
      expect(list).toHaveBeenCalledTimes(count);
    }
    enter(search, 'docs/missing.txt');
    expect(await screen.findByRole('alert')).toHaveTextContent('not found');
    expect(onOpen).not.toHaveBeenCalled();
    expect(onPreview).not.toHaveBeenCalled();
  });

  it('ignores a stale lookup after the user changes the query', async () => {
    const { list, onPreview } = setup();
    await screen.findByRole('treeitem', { name: 'docs' });
    let finish!: (files: { filePath: string }[]) => void;
    list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const search = screen.getByRole('searchbox');
    enter(search, 'old.txt');
    fireEvent.change(search, { target: { value: 'new' } });
    finish([{ filePath: 'old.txt' }]);
    await waitFor(() => expect(search).toHaveAttribute('aria-busy', 'false'));
    expect(onPreview).not.toHaveBeenCalled();
    expect(search).toHaveValue('new');
  });

  it('updates both search fields across a portal when density changes, and retains the sidebar width when hidden', async () => {
    const { content, rerender } = setup({
      density: 'compact',
      radius: 'sharp',
      colorScheme: 'light',
    });
    await screen.findByRole('treeitem', { name: 'docs' });
    expect(screen.getByRole('searchbox')).toHaveStyle({ height: '27px' });
    fireEvent.click(screen.getByRole('button', { name: 'Workspace' }));
    const panel = await screen.findByRole('dialog');
    expect(within(panel).getByRole('searchbox')).toHaveStyle({
      height: '27px',
    });
    rerender(
      content({ density: 'spacious', radius: 'round', colorScheme: 'dark' }),
    );
    screen
      .getAllByRole('searchbox')
      .forEach((field) => expect(field).toHaveStyle({ height: '45px' }));
    expect(panel.style.getPropertyValue('--chat-panel-radius')).toContain(
      '+ 4px',
    );
    fireEvent.keyDown(within(panel).getByRole('searchbox'), { key: 'Escape' });
    const divider = screen.getByRole('separator', {
      name: 'Resize files panel',
    });
    fireEvent.keyDown(divider, { key: 'ArrowLeft' });
    expect(divider).toHaveAttribute('aria-valuenow', '276');
    fireEvent.click(screen.getByRole('button', { name: 'Toggle file tree' }));
    expect(screen.queryByRole('separator')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle file tree' }));
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '276',
    );
  });
});
