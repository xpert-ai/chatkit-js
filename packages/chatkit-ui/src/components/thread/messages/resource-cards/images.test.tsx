import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createResourceCardContent,
  type ResourceCardImage,
} from '@xpert-ai/chatkit-types';
import { MessageResourceCards } from './index';
import {
  ResourceCardContext,
  unavailableResourceCardActions,
} from '../../../../resource-cards/context';
import { WorkbenchPreviewContent } from '../../../../workbench/preview/WorkbenchPreview';

const images: ResourceCardImage[] = [
  '现场平面图',
  '施工流程图',
  '节点详图',
].map((title, index) => ({
  id: String(index),
  title,
  file: {
    viewKey: 'bid',
    fileKey: 'image',
    targetId: `project:version-${index}`,
  },
}));
const card = createResourceCardContent({
  resource: { namespace: 'bid', type: 'construction-images', id: 'task' },
  title: '施工组织 · 施工配图',
  content: [{ kind: 'image-gallery', images }],
  open: { target: 'workbench.view', viewKey: 'bid' },
});

describe('resource card image gallery', () => {
  beforeEach(() => {
    let id = 0;
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = vi.fn(() => `blob:image-${++id}`);
        static revokeObjectURL = vi.fn();
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());
  function fixture(gallery = images) {
    const loadResourceCardImage = vi.fn(
      async () => new Blob(['pixels'], { type: 'image/png' }),
    );
    const openResourceCardImage = vi.fn();
    const context = {
      ...unavailableResourceCardActions,

      loadResourceCardImage,
      openResourceCardImage,
      openResourceCard: vi.fn(async () => ({
        success: true as const,
        status: 'opened' as const,
      })),
    };
    const tree = () => (
      <ResourceCardContext.Provider value={context}>
        <MessageResourceCards
          message={{
            id: 'reply',
            type: 'assistant',
            content: JSON.parse(
              JSON.stringify(
                [card, card].map((item) => ({
                  ...item,
                  data: {
                    ...item.data,
                    content: [{ kind: 'image-gallery', images: gallery }],
                  },
                })),
              ),
            ),
          }}
        />
      </ResourceCardContext.Provider>
    );
    return { loadResourceCardImage, openResourceCardImage, tree };
  }
  it('loads only the first responsive row until more is clicked, then can collapse', async () => {
    const callbacks: Array<(width: number) => void> = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(
          callback: (
            entries: Array<{ contentRect: { width: number } }>,
          ) => void,
        ) {
          callbacks.push((width) => callback([{ contentRect: { width } }]));
        }
        observe() {}
        disconnect() {}
      },
    );
    const gallery = Array.from({ length: 7 }, (_, i) => ({
      ...images[0],
      id: String(i),
      title: `图片${i}`,
    }));
    const f = fixture(gallery);
    const ui = render(f.tree());
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(3));
    expect(f.loadResourceCardImage).toHaveBeenCalledTimes(3);
    expect(screen.queryByText('图片3')).not.toBeInTheDocument();
    act(() => callbacks[0](340));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    act(() => callbacks[0](200));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    const more = screen.getByRole('button', { name: /More images|更多图片/ });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(7));
    expect(
      screen.getByRole('button', { name: /Collapse images|收起图片/ }),
    ).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(
      screen.getByRole('button', { name: /Collapse images|收起图片/ }),
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    ui.unmount();
  });
  it('renders one ordered group on history reload and opens an image only on click', async () => {
    const f = fixture(),
      ui = render(f.tree());
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(3));
    expect(screen.getAllByTestId('resource-card')).toHaveLength(1);
    expect(screen.getByRole('list', { name: card.data.title })).toBeVisible();
    expect(
      screen.getAllByRole('img').map((node) => node.getAttribute('alt')),
    ).toEqual(images.map((image) => image.title));
    expect(f.openResourceCardImage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('img', { name: '现场平面图' }));
    expect(f.openResourceCardImage).toHaveBeenCalledWith(images[0]);
    ui.rerender(f.tree());
    expect(f.loadResourceCardImage).toHaveBeenCalledTimes(3);
    ui.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
  });
  it('retries failed thumbnails without resubmitting any task', async () => {
    const f = fixture();
    f.loadResourceCardImage.mockRejectedValueOnce(new Error('expired'));
    const ui = render(f.tree());
    await screen.findByRole('status');
    fireEvent.click(screen.getByRole('button', { name: /Retry|重试/ }));
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(3));
    expect(f.loadResourceCardImage).toHaveBeenCalledTimes(4);
    expect(f.openResourceCardImage).not.toHaveBeenCalled();
    ui.unmount();
  });
  it('loads and releases a separate file-preview URL when chat cards unmount', async () => {
    const f = fixture(),
      cards = render(f.tree());
    await screen.findByRole('img', { name: '现场平面图' });
    const load = vi.fn(
      async (_signal: AbortSignal) => new Blob(['full'], { type: 'image/png' }),
    );
    const preview = render(
      <WorkbenchPreviewContent
        preview={{
          key: 'image',
          kind: 'resource-file',
          title: '完整图片',
          source: {
            load: async (signal) => ({
              blob: await load(signal),
              fileName: 'image.png',
            }),
            download: vi.fn(),
          },
        }}
      />,
    );
    const img = await screen.findByRole('img', { name: '完整图片' });
    const url = img.getAttribute('src');
    cards.unmount();
    expect(img).toBeVisible();
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(url);
    preview.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
  });
});
