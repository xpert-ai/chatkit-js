import * as React from 'react';
import { Client } from '@xpert-ai/xpert-sdk';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { cleanup } from '@testing-library/react';
import { initI18n } from '../../../i18n';
import { ThemeProvider } from '../../../providers/Theme';
import { WorkspaceFiles } from './WorkspaceFiles';

const originalClipboard = Object.getOwnPropertyDescriptor(
  navigator,
  'clipboard',
);
function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  return writeText;
}
async function openFileActions() {
  fireEvent.keyDown(screen.getByRole('button', { name: 'File actions' }), {
    key: 'ArrowDown',
  });
  return screen.findByRole('menu');
}

function setup() {
  const client = new Client({ apiUrl: 'https://example.test/api/ai' });
  vi.spyOn(client.workbench, 'listFiles').mockImplementation(
    async (_scope, path) =>
      path === 'reports'
        ? [
            {
              filePath: 'budget.xlsx',
              fullPath: 'reports/budget.xlsx',
              directory: 'reports',
            },
          ]
        : [{ filePath: 'reports', hasChildren: true }],
  );
  const upload = vi
    .spyOn(client.workbench, 'uploadFile')
    .mockResolvedValue({ filePath: 'notes/readme.md' });
  const onOpen = vi.fn();
  render(
    <ThemeProvider>
      <WorkspaceFiles
        client={client}
        scope={{ kind: 'assistant', assistantId: 'assistant' }}
        onOpen={onOpen}
      />
    </ThemeProvider>,
  );
  return { upload, onOpen };
}

describe('WorkspaceFiles creation', () => {
  it('does not overwrite an existing nested file while creating a new file', async () => {
    const { upload } = setup();
    await screen.findByRole('treeitem', { name: 'reports' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'File actions' }), {
      key: 'ArrowDown',
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'New file' }));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'reports/budget.xlsx' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(screen.getAllByRole('alert')[0]).toHaveTextContent(
        'path already exists',
      ),
    );
    expect(upload).not.toHaveBeenCalled();
  });

  it('creates the file in the intended parent and opens the returned file', async () => {
    const { upload, onOpen } = setup();
    await screen.findByRole('treeitem', { name: 'reports' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'File actions' }), {
      key: 'ArrowDown',
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'New file' }));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'notes/readme.md' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(onOpen).toHaveBeenCalledWith({ filePath: 'notes/readme.md' }),
    );
    expect(upload).toHaveBeenCalledWith(
      { kind: 'assistant', assistantId: 'assistant' },
      'notes',
      expect.any(Blob),
      'readme.md',
    );
  });
});

vi.mock('../../../components/code-editor/CodeEditor', () => ({
  default: ({ value, readOnly }: { value: string; readOnly: boolean }) => (
    <textarea aria-label="File source" value={value} readOnly={readOnly} />
  ),
}));
beforeEach(async () => {
  await initI18n().changeLanguage('en-US');
  vi.stubGlobal('Blob', NodeBlob);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalClipboard)
    Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

function browserSetup() {
  const client = new Client({ apiUrl: 'https://example.test/api/ai' });
  const list = vi
    .spyOn(client.workbench, 'listFiles')
    .mockImplementation(async (_scope, path) =>
      path === 'docs'
        ? [
            {
              filePath: 'README.md',
              fullPath: 'docs/README.md',
              directory: 'docs',
            },
            {
              filePath: 'notes.txt',
              fullPath: 'docs/notes.txt',
              directory: 'docs',
            },
            ...['docx', 'xlsx', 'xls', 'pptx'].map((extension) => ({
              filePath: `report.${extension}`,
              fullPath: `docs/report.${extension}`,
              directory: 'docs',
            })),
          ]
        : [{ filePath: 'docs', fileType: 'directory' }],
    );
  const download = vi
    .spyOn(client.workbench, 'downloadFile')
    .mockResolvedValue(
      new Blob(['# File preview\n\nA **formatted** document.']),
    );
  const onOpen = vi.fn();
  const onPreview = vi.fn();
  const view = render(
    <ThemeProvider>
      <WorkspaceFiles
        client={client}
        scope={{ kind: 'assistant', assistantId: 'a1' }}
        onOpen={onOpen}
        onPreview={onPreview}
      />
    </ThemeProvider>,
  );
  return { client, list, download, onOpen, onPreview, ...view };
}
describe('workspace file browser', () => {
  it('opens a breadcrumb subtree, filters and switches files without interrupting the current preview', async () => {
    const { list, download, onPreview } = browserSetup();
    fireEvent.click(await screen.findByRole('treeitem', { name: 'docs' }));
    fireEvent.click(await screen.findByRole('treeitem', { name: 'README.md' }));
    await screen.findByRole('heading', { name: 'File preview' });
    fireEvent.click(screen.getByRole('button', { name: 'View source' }));
    const preview = await screen.findByRole('textbox', { name: 'File source' });
    fireEvent.click(screen.getByRole('button', { name: 'Toggle file tree' }));
    const folder = screen.getByRole('button', { name: 'docs' });
    fireEvent.click(folder);
    const panel = await screen.findByRole('dialog', { name: 'Files in docs' });
    expect(within(panel).queryByRole('treeitem', { name: 'docs' })).toBeNull();
    expect(
      within(panel).getByRole('treeitem', { name: 'README.md' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(preview).toBeVisible();
    expect(list).toHaveBeenCalledTimes(2);
    expect(download).toHaveBeenCalledTimes(1);
    expect(onPreview).toHaveBeenCalledTimes(1);
    fireEvent.change(within(panel).getByRole('searchbox'), {
      target: { value: 'notes' },
    });
    expect(
      within(panel).queryByRole('treeitem', { name: 'README.md' }),
    ).toBeNull();
    download.mockResolvedValueOnce(new Blob(['Selected from the path']));
    fireEvent.click(within(panel).getByRole('treeitem', { name: 'notes.txt' }));
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'File source' })).toHaveValue(
        'Selected from the path',
      ),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('tree')).toBeNull();
    expect(
      screen.getByRole('navigation', { name: 'File path' }),
    ).toHaveTextContent('docsnotes.txt');
    expect(onPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({ filePath: 'docs/notes.txt' }),
    );

    fireEvent.click(folder);
    const reopened = await screen.findByRole('dialog', {
      name: 'Files in docs',
    });
    const search = within(reopened).getByRole('searchbox');
    expect(search).toHaveValue('');
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    expect(
      within(reopened).getByRole('treeitem', { name: 'notes.txt' }),
    ).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(folder).toHaveFocus();
    expect(screen.getByRole('textbox', { name: 'File source' })).toHaveValue(
      'Selected from the path',
    );
  });

  it('lazily expands nested folders in the path panel and opens Office files in their editor', async () => {
    const { list, download, onOpen } = browserSetup();
    list.mockImplementation(async (_scope, path) => {
      if (path === 'docs')
        return [
          {
            filePath: 'nested',
            fileType: 'directory',
            hasChildren: true,
            children: null,
          },
        ];
      if (path === 'docs/nested')
        return [{ filePath: 'budget.xlsx', directory: path }];
      return [{ filePath: 'docs', fileType: 'directory' }];
    });
    fireEvent.click(await screen.findByRole('treeitem', { name: 'docs' }));
    await screen.findByRole('treeitem', { name: 'nested' });
    fireEvent.click(screen.getByRole('button', { name: 'Toggle file tree' }));
    fireEvent.click(screen.getByRole('button', { name: 'docs' }));
    const panel = await screen.findByRole('dialog', { name: 'Files in docs' });
    fireEvent.keyDown(within(panel).getByRole('searchbox'), {
      key: 'ArrowDown',
    });
    const folder = within(panel).getByRole('treeitem', { name: 'nested' });
    expect(folder).toHaveFocus();
    expect(list).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(folder, { key: 'ArrowRight' });
    const file = await within(panel).findByRole('treeitem', {
      name: 'budget.xlsx',
    });
    expect(list).toHaveBeenLastCalledWith(
      expect.anything(),
      'docs/nested',
      expect.anything(),
    );
    expect(file).toHaveAttribute('aria-level', '2');
    fireEvent.keyDown(folder, { key: 'ArrowRight' });
    expect(file).toHaveFocus();
    fireEvent.click(file);
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: 'docs/nested/budget.xlsx' }),
    );
    expect(download).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows loading and retry for the selected breadcrumb directory instead of a false empty state', async () => {
    const { list } = browserSetup();
    list.mockRejectedValueOnce(new Error('Directory unavailable'));
    fireEvent.click(await screen.findByRole('treeitem', { name: 'docs' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Toggle file tree' }));
    fireEvent.click(screen.getByRole('button', { name: 'docs' }));
    const panel = await screen.findByRole('dialog', { name: 'Files in docs' });
    expect(within(panel).getByRole('alert')).toHaveTextContent(
      'Directory unavailable',
    );
    let resolve!: (files: []) => void;
    list.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    fireEvent.click(within(panel).getByRole('button', { name: 'Retry' }));
    expect(within(panel).getByRole('tree')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(within(panel).queryByText('This folder is empty')).toBeNull();
    resolve([]);
    expect(
      await within(panel).findByText('This folder is empty'),
    ).toBeVisible();
    expect(within(panel).getByRole('tree')).toHaveAttribute(
      'aria-busy',
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Workspace' }));
    expect(
      await screen.findByRole('dialog', { name: 'Files in Workspace' }),
    ).toBeVisible();
    expect(screen.queryByRole('dialog', { name: 'Files in docs' })).toBeNull();
  });

  it('keeps the file, source mode and breadcrumb while toggling folders or hiding the tree', async () => {
    const { onPreview, download } = browserSetup();
    fireEvent.click(await screen.findByRole('treeitem', { name: 'docs' }));
    fireEvent.click(await screen.findByRole('treeitem', { name: 'README.md' }));
    await screen.findByRole('heading', { name: 'File preview' });
    fireEvent.click(screen.getByRole('button', { name: 'View source' }));
    await screen.findByRole('textbox', { name: 'File source' });
    fireEvent.click(screen.getByRole('treeitem', { name: 'docs' }));
    expect(screen.getByRole('treeitem', { name: 'docs' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('textbox', { name: 'File source' })).toBeVisible();
    expect(
      within(screen.getByRole('navigation', { name: 'File path' })).getByRole(
        'button',
        { name: 'README.md' },
      ),
    ).toHaveAttribute('aria-current', 'page');
    fireEvent.keyDown(screen.getByRole('treeitem', { name: 'docs' }), {
      key: 'ArrowRight',
    });
    fireEvent.keyDown(screen.getByRole('treeitem', { name: 'docs' }), {
      key: 'ArrowLeft',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Toggle file tree' }));
    expect(screen.getByRole('textbox', { name: 'File source' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle file tree' }));
    fireEvent.click(screen.getByRole('treeitem', { name: 'docs' }));
    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledTimes(1);
    download.mockResolvedValue(new Blob(['Another file']));
    fireEvent.click(screen.getByRole('treeitem', { name: 'notes.txt' }));
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'File source' })).toHaveValue(
        'Another file',
      ),
    );
    expect(onPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({ filePath: 'docs/notes.txt' }),
    );
  });
  it('copies complete workspace paths and reuses the loaded original text for the menu', async () => {
    const copy = mockClipboard();
    const { download } = browserSetup();
    fireEvent.click(screen.getByRole('button', { name: 'Copy path' }));
    await waitFor(() => expect(copy).toHaveBeenLastCalledWith('/'));
    fireEvent.click(await screen.findByRole('treeitem', { name: 'docs' }));
    fireEvent.click(await screen.findByRole('treeitem', { name: 'README.md' }));
    await screen.findByRole('heading', { name: 'File preview' });
    fireEvent.click(screen.getByRole('button', { name: 'Copy path' }));
    await waitFor(() =>
      expect(copy).toHaveBeenLastCalledWith('docs/README.md'),
    );
    await openFileActions();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy path' }));
    await waitFor(() => expect(copy).toHaveBeenCalledTimes(3));
    expect(copy).toHaveBeenLastCalledWith('docs/README.md');
    await openFileActions();
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Copy file contents' }),
    );
    await waitFor(() =>
      expect(copy).toHaveBeenLastCalledWith(
        '# File preview\n\nA **formatted** document.',
      ),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Copied');
    expect(download).toHaveBeenCalledTimes(1);
  });
  it('disables content copying for folders and a new preview that is loading or failed', async () => {
    const { download } = browserSetup();
    await openFileActions();
    expect(
      screen.getByRole('menuitem', { name: 'Copy file contents' }),
    ).toHaveAttribute('aria-disabled', 'true');
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    fireEvent.click(await screen.findByRole('treeitem', { name: 'docs' }));
    fireEvent.click(await screen.findByRole('treeitem', { name: 'README.md' }));
    await screen.findByRole('heading', { name: 'File preview' });
    let reject!: (error: Error) => void;
    download.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    fireEvent.click(screen.getByRole('treeitem', { name: 'notes.txt' }));
    await openFileActions();
    expect(
      screen.getByRole('menuitem', { name: 'Copy file contents' }),
    ).toHaveAttribute('aria-disabled', 'true');
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    reject(new Error('Download failed'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Download failed',
    );
    await openFileActions();
    expect(
      screen.getByRole('menuitem', { name: 'Copy file contents' }),
    ).toHaveAttribute('aria-disabled', 'true');
  });
  it('reports a clipboard failure and allows retrying without leaving the preview', async () => {
    const copy = mockClipboard();
    copy.mockRejectedValueOnce(new Error('Clipboard denied'));
    browserSetup();
    fireEvent.click(await screen.findByRole('treeitem', { name: 'docs' }));
    fireEvent.click(await screen.findByRole('treeitem', { name: 'README.md' }));
    await screen.findByRole('heading', { name: 'File preview' });
    fireEvent.click(screen.getByRole('button', { name: 'Copy path' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not copy',
    );
    expect(screen.queryByText('Copied')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Copy path' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Copied'),
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('heading', { name: 'File preview' })).toBeVisible();
  });
  it.each(['fullPath', 'entryName', 'workspacePath'] as const)(
    'expands nested directories and uses complete paths for preview and Office editors (%s)',
    async (shape) => {
      const { list, download, onOpen } = browserSetup();
      const entry = (parent: string, name: string, folder = false) => ({
        filePath: shape === 'workspacePath' ? `${parent}/${name}` : name,
        ...(shape === 'fullPath' ? { fullPath: `${parent}/${name}` } : {}),
        directory: parent,
        fileType: folder ? 'directory' : 'file',
        hasChildren: folder,
        children: null,
      });
      list.mockImplementation(async (_scope, path) => {
        if (path === 'docs') return [entry(path, 'web-acceptance-v1', true)];
        if (path === 'docs/web-acceptance-v1')
          return [entry(path, 'notes.txt'), entry(path, 'budget.xlsx')];
        return [{ filePath: 'docs', fileType: 'directory' }];
      });
      fireEvent.click(await screen.findByRole('treeitem', { name: 'docs' }));
      fireEvent.click(
        await screen.findByRole('treeitem', { name: 'web-acceptance-v1' }),
      );
      fireEvent.click(
        await screen.findByRole('treeitem', { name: 'notes.txt' }),
      );
      expect(
        await screen.findByRole('textbox', { name: 'File source' }),
      ).toHaveValue('# File preview\n\nA **formatted** document.');
      expect(list).toHaveBeenLastCalledWith(
        expect.anything(),
        'docs/web-acceptance-v1',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(download).toHaveBeenCalledWith(
        expect.anything(),
        'docs/web-acceptance-v1/notes.txt',
        expect.anything(),
      );
      expect(screen.queryByText('This folder is empty')).toBeNull();
      fireEvent.click(screen.getByRole('treeitem', { name: 'budget.xlsx' }));
      expect(onOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          filePath: 'docs/web-acceptance-v1/budget.xlsx',
        }),
      );
    },
  );
  it('loads expanded folders lazily and previews Markdown inline with a read-only source toggle', async () => {
    const { list, download, onOpen, onPreview } = browserSetup();
    expect(
      screen.getByText('Select a file from the workspace tree'),
    ).toBeVisible();
    fireEvent.click(await screen.findByRole('treeitem', { name: 'docs' }));
    fireEvent.click(await screen.findByRole('treeitem', { name: 'README.md' }));
    expect(
      await screen.findByRole('heading', { name: 'File preview' }),
    ).toBeVisible();
    expect(onOpen).not.toHaveBeenCalled();
    expect(onPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({ filePath: 'docs/README.md' }),
    );
    expect(list).toHaveBeenCalledTimes(2);
    expect(download).toHaveBeenCalledWith(
      { kind: 'assistant', assistantId: 'a1' },
      'docs/README.md',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'View source' }));
    expect(
      await screen.findByRole('textbox', { name: 'File source' }),
    ).toHaveAttribute('readonly');
    expect(download).toHaveBeenCalledTimes(1);
  });
  it('previews plain text, keeps parent folders visible when filtering, and toggles the tree', async () => {
    const { onOpen } = browserSetup();
    fireEvent.click(await screen.findByRole('treeitem', { name: 'docs' }));
    fireEvent.click(await screen.findByRole('treeitem', { name: 'notes.txt' }));
    expect(
      await screen.findByRole('textbox', { name: 'File source' }),
    ).toHaveAttribute('readonly');
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'notes' },
    });
    expect(screen.getByRole('treeitem', { name: 'docs' })).toBeVisible();
    expect(screen.queryByRole('treeitem', { name: 'README.md' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle file tree' }));
    expect(screen.queryByRole('tree')).toBeNull();
  });
  it.each(['docx', 'xlsx', 'xls', 'pptx'])(
    'opens %s in a separate editor instead of downloading into the preview',
    async (extension) => {
      const { onOpen, download } = browserSetup();
      fireEvent.click(await screen.findByRole('treeitem', { name: 'docs' }));
      fireEvent.click(
        await screen.findByRole('treeitem', { name: `report.${extension}` }),
      );
      expect(onOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          filePath: `docs/report.${extension}`,
        }),
      );
      expect(download).not.toHaveBeenCalled();
    },
  );
  it('ignores a slow preview response after selecting another file', async () => {
    const { download } = browserSetup();
    let resolve!: (blob: Blob) => void;
    download
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValue(new Blob(['Latest file']));
    fireEvent.click(await screen.findByRole('treeitem', { name: 'docs' }));
    fireEvent.click(await screen.findByRole('treeitem', { name: 'README.md' }));
    fireEvent.click(screen.getByRole('treeitem', { name: 'notes.txt' }));
    expect(
      await screen.findByRole('textbox', { name: 'File source' }),
    ).toHaveValue('Latest file');
    resolve(new Blob(['# Stale file']));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Stale file' })).toBeNull(),
    );
  });
  it('clears the previous workspace tree and preview when scope changes', async () => {
    const { client, list, rerender, onOpen } = browserSetup();
    fireEvent.click(await screen.findByRole('treeitem', { name: 'docs' }));
    fireEvent.click(await screen.findByRole('treeitem', { name: 'README.md' }));
    await screen.findByRole('heading', { name: 'File preview' });
    fireEvent.click(screen.getByRole('button', { name: 'docs' }));
    await screen.findByRole('dialog', { name: 'Files in docs' });
    list.mockResolvedValue([]);
    rerender(
      <ThemeProvider>
        <WorkspaceFiles
          client={client}
          scope={{ kind: 'assistant', assistantId: 'a2' }}
          onOpen={onOpen}
        />
      </ThemeProvider>,
    );
    expect(screen.queryByRole('heading', { name: 'File preview' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await screen.findByText('This folder is empty')).toBeVisible();
  });
});
