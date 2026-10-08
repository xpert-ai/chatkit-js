import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FilePreview } from './FilePreview';

describe('resource file preview lifecycle', () => {
  beforeEach(() =>
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = vi.fn(() => 'blob:preview');
        static revokeObjectURL = vi.fn();
      },
    ),
  );
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  it('retries image decode failures in the full file preview', async () => {
    const file = {
      load: vi.fn(async () => ({
        blob: new Blob(['image'], { type: 'image/png' }),
        fileName: 'image.png',
      })),
      download: vi.fn(async () => undefined),
    };
    render(<FilePreview file={file} title="Image" />);
    fireEvent.error(await screen.findByRole('img', { name: 'Image' }));
    expect(screen.getByRole('alert')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Retry|重试/ }));
    expect(await screen.findByRole('img', { name: 'Image' })).toBeVisible();
    expect(file.load).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });
  it('renders Markdown from any file source and keeps its original download', async () => {
    const file = {
      load: vi.fn(async () => ({
        blob: new Blob(['# 项目交付\n\n正文内容'], {
          type: 'text/markdown',
        }),
        fileName: 'delivery.md',
      })),
      download: vi.fn(async () => undefined),
    };
    render(<FilePreview file={file} title="交付说明" />);
    expect(
      await screen.findByRole('heading', { name: '项目交付' }),
    ).toBeVisible();
    expect(screen.getByText('正文内容')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Download|下载/ }));
    await waitFor(() => expect(file.download).toHaveBeenCalledOnce());
  });

  it('cancels the old source and ignores late bytes after switching files', async () => {
    let finish!: (file: { blob: Blob; fileName: string }) => void;
    const old = vi.fn(
      (_signal: AbortSignal) =>
        new Promise<{ blob: Blob; fileName: string }>((resolve) => {
          finish = resolve;
        }),
    );
    const next = vi.fn(async () => ({
      blob: new Blob(['new'], { type: 'image/png' }),
      fileName: 'new.png',
    }));
    const ui = render(
      <FilePreview file={{ load: old, download: vi.fn() }} title="Old" />,
    );
    ui.rerender(
      <FilePreview file={{ load: next, download: vi.fn() }} title="New" />,
    );
    await screen.findByRole('img', { name: 'New' });
    expect(old.mock.calls[0][0].aborted).toBe(true);
    await act(async () =>
      finish({ blob: new Blob(['late']), fileName: 'old.png' }),
    );
    expect(screen.getByRole('img', { name: 'New' })).toBeVisible();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    ui.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
  it('keeps the original downloadable when preview is unavailable, and retries the preview', async () => {
    const file = {
      load: vi.fn(async () => ({
        blob: new Blob(['%PDF'], { type: 'application/pdf' }),
        fileName: '预览.pdf',
      })),
      download: vi.fn(async () => undefined),
    };
    file.load.mockRejectedValueOnce(new Error('preview pending'));
    const ui = render(<FilePreview file={file} title="原件.docx" />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: /Download|下载/ }));
    await waitFor(() => expect(file.download).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: /Retry|重试/ }));
    await waitFor(() =>
      expect(screen.getByTitle('原件.docx')).toHaveAttribute(
        'src',
        'blob:preview',
      ),
    );
    expect(file.load).toHaveBeenCalledTimes(2);
    ui.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });
  it('aborts a closed preview and ignores late bytes', async () => {
    let finish!: (file: { blob: Blob; fileName: string }) => void;
    const load = vi.fn(
      (_signal: AbortSignal) =>
        new Promise<{ blob: Blob; fileName: string }>((resolve) => {
          finish = resolve;
        }),
    );
    const ui = render(
      <FilePreview file={{ load, download: vi.fn() }} title="file.pdf" />,
    );
    ui.unmount();
    expect(load.mock.calls[0][0].aborted).toBe(true);
    await act(async () =>
      finish({ blob: new Blob(['late']), fileName: 'file.pdf' }),
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
