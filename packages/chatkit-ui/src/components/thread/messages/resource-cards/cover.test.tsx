import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createResourceCardContent } from '@xpert-ai/chatkit-types';
import {
  ResourceCardContext,
  unavailableResourceCardActions,
} from '../../../../resource-cards/context';
import { MessageResourceCards } from './index';

const title = '企业协作汇报';
const cover = {
  id: 'revision1',
  title,
  file: { viewKey: 'pptx', targetId: 'snapshot', fileKey: 'cover1' },
};
const file = {
  id: 'snapshot',
  title,
  file: { viewKey: 'pptx', targetId: 'snapshot', fileKey: 'file' },
};
const card = createResourceCardContent({
  resource: { namespace: 'example', type: 'presentation', id: 'original' },
  title,
  open: { target: 'workbench.view', viewKey: 'pptx', selectionId: 'original' },
  content: [
    { kind: 'image-gallery', images: [cover] },
    { kind: 'file-list', files: [file] },
  ],
});
const message = { id: 'reply', type: 'assistant' as const, content: [card] };

describe('file cover card', () => {
  beforeEach(() => {
    let id = 0;
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = vi.fn(() => `blob:cover-${++id}`);
        static revokeObjectURL = vi.fn();
      },
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('loads an authorized cover and opens the document from it without duplicating title or file rows', async () => {
    const loadResourceCardImage = vi.fn(
      async () => new Blob(['png'], { type: 'image/png' }),
    );
    const openResourceCard = vi
      .fn()
      .mockResolvedValue({ success: true, status: 'opened' });
    const ui = render(
      <ResourceCardContext.Provider
        value={{
          ...unavailableResourceCardActions,
          loadResourceCardImage,
          openResourceCard,
        }}
      >
        <MessageResourceCards message={message} />
      </ResourceCardContext.Provider>,
    );
    await waitFor(() =>
      expect(screen.getByRole('img', { name: title })).toHaveAttribute(
        'src',
        'blob:cover-1',
      ),
    );
    expect(loadResourceCardImage).toHaveBeenCalledWith(
      cover,
      expect.any(AbortSignal),
    );
    expect(screen.getAllByTestId('resource-card')).toHaveLength(1);
    expect(screen.getAllByText(title)).toHaveLength(1);
    expect(ui.container.querySelector('ul')).toBeNull();
    fireEvent.click(
      screen.getAllByRole('button', { name: /^(Open|打开) / })[0],
    );
    await waitFor(() =>
      expect(openResourceCard).toHaveBeenCalledWith(card, 'reply'),
    );
    ui.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cover-1');
  });

  it('keeps open/download available when preview fails and allows an authorized retry', async () => {
    const loadResourceCardFileMetadata = vi.fn(async () => ({
      mimeType: 'application/vnd.ms-powerpoint',
    }));
    const loadResourceCardImage = vi
      .fn()
      .mockRejectedValueOnce(new Error('preview unavailable'))
      .mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
    render(
      <ResourceCardContext.Provider
        value={{
          ...unavailableResourceCardActions,
          loadResourceCardImage,
          loadResourceCardFileMetadata,
          openResourceCard: vi.fn(),
          downloadResourceCardFile: vi.fn(),
        }}
      >
        <MessageResourceCards message={message} />
      </ResourceCardContext.Provider>,
    );
    await waitFor(() => expect(screen.getByRole('status')).toBeVisible());
    await waitFor(() =>
      expect(
        document.querySelector('[data-file-type="powerpoint"]'),
      ).not.toBeNull(),
    );
    expect(loadResourceCardFileMetadata).toHaveBeenCalledWith(
      file.file,
      expect.any(AbortSignal),
    );
    expect(
      screen.getByRole('button', { name: /^(Download|下载) / }),
    ).toBeEnabled();
    expect(
      screen
        .getAllByRole('button', { name: /^(Open|打开) / })
        .every((button) => !button.hasAttribute('disabled')),
    ).toBe(true);
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: /^(Retry|重试)$/ })),
    );
    await waitFor(() => expect(screen.getByRole('img')).toBeVisible());
    expect(loadResourceCardImage).toHaveBeenCalledTimes(2);
  });
});
