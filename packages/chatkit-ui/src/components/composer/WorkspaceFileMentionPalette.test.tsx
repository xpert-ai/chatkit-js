import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Client, XpertWorkspaceFile } from '@xpert-ai/xpert-sdk';
import {
  WorkspaceFileMentionPalette,
  type WorkspaceFileMentionPaletteHandle,
} from './WorkspaceFileMentionPalette';
import * as React from 'react';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string) =>
      ({
        'composer.fileMentions.title': 'Workspace files',
        'composer.fileMentions.loading': 'Loading files...',
        'composer.fileMentions.empty': 'No matching workspace files',
        'composer.fileMentions.unavailable': 'No workspace is available',
        'composer.fileMentions.loadError': 'Failed to load workspace files',
      })[key] ?? key,
  }),
}));

const files: XpertWorkspaceFile[] = [
  {
    filePath: 'briefs',
    fullPath: 'briefs',
    fileType: 'directory',
    hasChildren: true,
    children: [
      {
        filePath: 'Product brief.pdf',
        fullPath: 'briefs/Product brief.pdf',
        directory: 'briefs',
        fileType: 'pdf',
        hasChildren: false,
        mimeType: 'application/pdf',
        size: 2048,
      },
    ],
  },
  {
    filePath: 'Meeting notes.md',
    fullPath: 'Meeting notes.md',
    fileType: 'md',
    hasChildren: false,
    mimeType: 'text/markdown',
    size: 1024,
  },
];

function createClient(result: XpertWorkspaceFile[] = files) {
  return {
    projects: {
      listFiles: vi.fn().mockResolvedValue(result),
    },
    xperts: {
      listWorkspaceFiles: vi.fn().mockResolvedValue(result),
    },
  } as unknown as Client;
}

describe('WorkspaceFileMentionPalette', () => {
  it('loads, flattens, filters, and selects an assistant workspace file', async () => {
    const client = createClient();
    const onSelect = vi.fn();
    const { rerender } = render(
      <WorkspaceFileMentionPalette
        client={client}
        assistantId="assistant-1"
        projectId={null}
        query=""
        selectedFilePaths={new Set()}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText('Loading files...')).toBeInTheDocument();
    await screen.findByText('Product brief.pdf');
    expect(client.xperts.listWorkspaceFiles).toHaveBeenCalledWith(
      'assistant-1',
      expect.objectContaining({
        depth: expect.any(Number),
        signal: expect.any(AbortSignal),
      }),
    );
    expect(
      screen.queryByRole('button', { name: 'briefs' }),
    ).not.toBeInTheDocument();

    await act(async () => {
      rerender(
        <WorkspaceFileMentionPalette
          client={client}
          assistantId="assistant-1"
          projectId={null}
          query="meeting"
          selectedFilePaths={new Set()}
          onSelect={onSelect}
        />,
      );
    });
    expect(screen.queryByText('Product brief.pdf')).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('button', { name: /Meeting notes/ }));
    expect(onSelect).toHaveBeenCalledWith(files[1]);
  });

  it('loads the selected project workspace instead of the assistant workspace', async () => {
    const client = createClient();
    render(
      <WorkspaceFileMentionPalette
        client={client}
        assistantId="assistant-1"
        projectId="project-1"
        query=""
        selectedFilePaths={new Set()}
        onSelect={vi.fn()}
      />,
    );

    await screen.findByText('Product brief.pdf');
    expect(client.projects.listFiles).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        depth: expect.any(Number),
        signal: expect.any(AbortSignal),
      }),
    );
    expect(client.xperts.listWorkspaceFiles).not.toHaveBeenCalled();
  });

  it('supports keyboard selection and reports loading errors', async () => {
    const client = createClient();
    const onSelect = vi.fn();
    const paletteRef = React.createRef<WorkspaceFileMentionPaletteHandle>();
    const { unmount } = render(
      <WorkspaceFileMentionPalette
        ref={paletteRef}
        client={client}
        assistantId="assistant-1"
        projectId={null}
        query=""
        selectedFilePaths={new Set()}
        onSelect={onSelect}
      />,
    );
    await screen.findByText('Product brief.pdf');
    act(() => paletteRef.current?.moveActive(1));
    expect(paletteRef.current?.selectActive()).toBe(true);
    expect(onSelect).toHaveBeenCalledWith(files[1]);
    unmount();

    const errorClient = createClient();
    vi.mocked(errorClient.xperts.listWorkspaceFiles).mockRejectedValue(
      new Error('forbidden'),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(
      <WorkspaceFileMentionPalette
        client={errorClient}
        assistantId="assistant-2"
        projectId={null}
        query=""
        selectedFilePaths={new Set()}
        onSelect={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Failed to load workspace files',
      ),
    );
    warn.mockRestore();
  });
});
