import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResourceCardContext } from '../../../../resource-cards/context';
import { ResourceCardFileIcon } from './file-icon';

const file = {
  id: 'original',
  title: 'Misleading presentation.pptx',
  file: { viewKey: 'files', fileKey: 'opaque', targetId: 'original' },
};
describe('shared resource file artwork', () => {
  it.each([
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'word',
    ],
    [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'excel',
    ],
    [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'powerpoint',
    ],
    ['application/pdf', 'pdf'],
  ])(
    'selects existing artwork from %s rather than the title',
    async (mimeType, icon) => {
      const loadResourceCardFileMetadata = vi.fn(async () => ({ mimeType }));
      const ui = render(
        <ResourceCardContext.Provider value={{ loadResourceCardFileMetadata }}>
          <ResourceCardFileIcon file={file} />
        </ResourceCardContext.Provider>,
      );
      await waitFor(() =>
        expect(
          ui.container.querySelector(`[data-file-type="${icon}"]`),
        ).not.toBeNull(),
      );
      expect(loadResourceCardFileMetadata).toHaveBeenCalledExactlyOnceWith(
        file.file,
        expect.any(AbortSignal),
      );
      expect(ui.container.querySelector('img')?.src).toMatch(
        /^data:image\/svg\+xml,/,
      );
    },
  );
  it('keeps the generic file artwork when access is denied', async () => {
    const loadResourceCardFileMetadata = vi
      .fn()
      .mockRejectedValue(new Error('Forbidden'));
    const ui = render(
      <ResourceCardContext.Provider value={{ loadResourceCardFileMetadata }}>
        <ResourceCardFileIcon file={file} />
      </ResourceCardContext.Provider>,
    );
    await act(async () => undefined);
    expect(
      ui.container.querySelector('[data-file-type="file"]'),
    ).not.toBeNull();
  });
  it('discards stale results when the file changes or the card unmounts', async () => {
    let finish!: (value: { mimeType: string }) => void;
    const signals: AbortSignal[] = [];
    const loadResourceCardFileMetadata = vi.fn((_file, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<{ mimeType: string }>((resolve) => {
        finish = resolve;
      });
    });
    const view = (targetId: string) => (
      <ResourceCardContext.Provider value={{ loadResourceCardFileMetadata }}>
        <ResourceCardFileIcon
          file={{ ...file, file: { ...file.file, targetId } }}
        />
      </ResourceCardContext.Provider>
    );
    const ui = render(view('old'));
    const finishOld = finish;
    ui.rerender(view('new'));
    expect(signals[0].aborted).toBe(true);
    await act(async () => finishOld({ mimeType: 'application/pdf' }));
    expect(
      ui.container.querySelector('[data-file-type="file"]'),
    ).not.toBeNull();
    await act(async () => finish({ mimeType: 'application/vnd.ms-excel' }));
    expect(
      ui.container.querySelector('[data-file-type="excel"]'),
    ).not.toBeNull();
    ui.unmount();
    expect(signals[1].aborted).toBe(true);
  });
});
