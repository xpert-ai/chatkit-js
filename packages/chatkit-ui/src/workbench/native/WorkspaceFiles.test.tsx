import * as React from 'react';
import { Client } from '@xpert-ai/xpert-sdk';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { cleanup } from '@testing-library/react';
import { initI18n } from '../../i18n';
import { ThemeProvider } from '../../providers/Theme';
import { WorkspaceFiles } from './WorkspaceFiles';

function setup() {
  const client = new Client({ apiUrl: 'https://example.test/api/ai' });
  vi.spyOn(client.workbench, 'listFiles').mockImplementation(
    async (_scope, path) =>
      path === 'reports'
        ? [{ filePath: 'reports/budget.xlsx' }]
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

vi.mock('./CodeEditor', () => ({
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
});

function browserSetup() {
  const client = new Client({ apiUrl: 'https://example.test/api/ai' });
  const list = vi
    .spyOn(client.workbench, 'listFiles')
    .mockImplementation(async (_scope, path) =>
      path === 'docs'
        ? [
            { filePath: 'docs/README.md' },
            { filePath: 'docs/notes.txt' },
            ...['docx', 'xlsx', 'xls', 'pptx'].map((extension) => ({
              filePath: `docs/report.${extension}`,
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
    expect(onPreview).toHaveBeenLastCalledWith({ filePath: 'docs/README.md' });
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
      expect(onOpen).toHaveBeenCalledWith({
        filePath: `docs/report.${extension}`,
      });
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
    expect(await screen.findByText('This folder is empty')).toBeVisible();
  });
});
