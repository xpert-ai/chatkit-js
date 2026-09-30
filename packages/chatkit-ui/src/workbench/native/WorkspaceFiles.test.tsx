import * as React from 'react';
import { Client } from '@xpert-ai/xpert-sdk';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
    await screen.findByRole('button', { name: 'reports' });
    fireEvent.click(screen.getByRole('button', { name: 'New file' }));
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
    await screen.findByRole('button', { name: 'reports' });
    fireEvent.click(screen.getByRole('button', { name: 'New file' }));
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
