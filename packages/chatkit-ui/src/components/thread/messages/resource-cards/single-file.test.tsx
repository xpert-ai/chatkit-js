import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  createResourceCardContent,
  type ResourceCardFile,
} from '@xpert-ai/chatkit-types';
import {
  ResourceCardContext,
  unavailableResourceCardActions,
} from '../../../../resource-cards/context';
import { MessageResourceCards } from './index';

const file: ResourceCardFile = {
  id: 'snapshot',
  title: '南京元数模板能力验收',
  file: {
    viewKey: 'presentations',
    targetId: 'snapshot',
    fileKey: 'export.pptx',
  },
};
const draft = createResourceCardContent({
  resource: { namespace: 'example', type: 'presentation', id: 'original' },
  title: file.title,
  description: 'PPTX · 3 slides',
  open: {
    target: 'assistant.project',
    projectId: 'project',
    viewKey: 'presentations',
    selectionId: 'original',
  },
  content: [
    {
      kind: 'file-list',
      files: [
        {
          ...file,
          id: 'original',
          file: {
            ...file.file,
            targetId: 'original',
            fileKey: 'original.pptx',
          },
        },
      ],
    },
  ],
});
const exported = createResourceCardContent({
  ...draft.data,
  content: [{ kind: 'file-list', files: [file] }],
});
const message = {
  id: 'reply',
  type: 'assistant' as const,
  content: [draft, exported],
};

describe('compact single-file delivery', () => {
  it('uses the original file type and download target when a direct file card has a different preview format', async () => {
    const card = createResourceCardContent({
      resource: { namespace: 'example', type: 'file', id: 'original' },
      title: 'Quarterly report',
      open: {
        target: 'workbench.file',
        ...file.file,
        previewFile: {
          viewKey: 'preview',
          fileKey: 'converted.pdf',
          targetId: 'pdf',
        },
      },
    });
    const loadResourceCardFileMetadata = vi.fn(async () => ({
      mimeType: 'application/vnd.ms-powerpoint',
    }));
    const downloadResourceCardFile = vi.fn().mockResolvedValue(undefined);
    const ui = render(
      <ResourceCardContext.Provider
        value={{ loadResourceCardFileMetadata, downloadResourceCardFile }}
      >
        <MessageResourceCards message={{ ...message, content: [card] }} />
      </ResourceCardContext.Provider>,
    );
    await waitFor(() =>
      expect(
        ui.container.querySelector('[data-file-type="powerpoint"]'),
      ).not.toBeNull(),
    );
    expect(loadResourceCardFileMetadata).toHaveBeenCalledExactlyOnceWith(
      file.file,
      expect.any(AbortSignal),
    );
    fireEvent.click(screen.getByRole('button', { name: /^(下载|Download) / }));
    await waitFor(() =>
      expect(downloadResourceCardFile).toHaveBeenCalledWith({
        id: 'original',
        title: 'Quarterly report',
        file: file.file,
      }),
    );
  });

  it('shows one title and independently opens the draft and downloads the latest snapshot after history reload', async () => {
    const openResourceCard = vi
      .fn()
      .mockResolvedValue({ success: true, status: 'opened' });
    const downloadResourceCardFile = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <ResourceCardContext.Provider
        value={{
          ...unavailableResourceCardActions,
          openResourceCard,
          downloadResourceCardFile,
        }}
      >
        <MessageResourceCards message={JSON.parse(JSON.stringify(message))} />
      </ResourceCardContext.Provider>,
    );
    expect(screen.getAllByTestId('resource-card')).toHaveLength(1);
    expect(screen.getAllByText(file.title)).toHaveLength(1);
    expect(screen.getByText('PPTX · 3 slides')).toBeVisible();
    expect(container.querySelector('ul')).toBeNull();
    expect(openResourceCard).not.toHaveBeenCalled();
    expect(downloadResourceCardFile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^(打开|Open) / }));
    await waitFor(() =>
      expect(openResourceCard).toHaveBeenCalledExactlyOnceWith(
        exported,
        'reply',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: /^(下载|Download) / }));
    await waitFor(() =>
      expect(downloadResourceCardFile).toHaveBeenCalledExactlyOnceWith(file),
    );
  });

  it('updates a streamed draft in place and leaves distinct presentations separate', () => {
    const ui = render(
      <MessageResourceCards message={{ ...message, content: [draft] }} />,
    );
    const card = screen.getByTestId('resource-card');
    ui.rerender(<MessageResourceCards message={message} />);
    expect(screen.getByTestId('resource-card')).toBe(card);
    const other = createResourceCardContent({
      ...exported.data,
      resource: { ...exported.data.resource, id: 'other' },
    });
    ui.rerender(
      <MessageResourceCards
        message={{ ...message, content: [draft, exported, other] }}
      />,
    );
    expect(screen.getAllByTestId('resource-card')).toHaveLength(2);
  });

  it('prevents duplicate downloads and allows retry after a permission/network failure', async () => {
    let reject!: (error: Error) => void;
    const downloadResourceCardFile = vi.fn(
      () =>
        new Promise<void>((_, fail) => {
          reject = fail;
        }),
    );
    render(
      <ResourceCardContext.Provider
        value={{ ...unavailableResourceCardActions, downloadResourceCardFile }}
      >
        <MessageResourceCards message={message} />
      </ResourceCardContext.Provider>,
    );
    const button = screen.getByRole('button', { name: /^(下载|Download) / });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(downloadResourceCardFile).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    await act(async () => reject(new Error('revoked')));
    expect(screen.getByRole('alert')).toBeVisible();
    downloadResourceCardFile.mockResolvedValueOnce();
    await act(async () => fireEvent.click(button));
    expect(downloadResourceCardFile).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('preserves distinct file labels, descriptions and a context-specific opening action', () => {
    const attachment = {
      ...file,
      title: 'Appendix',
      description: 'Published PDF',
    };
    const card = createResourceCardContent({
      ...draft.data,
      content: [{ kind: 'file-list', files: [attachment] }],
    });
    render(
      <MessageResourceCards
        message={{ ...message, content: [card] }}
        openLabel="查看发布版本"
      />,
    );
    expect(screen.getByText('Appendix')).toBeVisible();
    expect(screen.getByText('Published PDF')).toBeVisible();
    expect(
      screen.getByRole('button', { name: `查看发布版本 ${draft.data.title}` }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /^(下载|Download) / }),
    ).toBeDisabled();
  });
});
