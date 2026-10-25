import { describe, expect, it, vi } from 'vitest';
import { loadImagePreview, type ImagePreviewClient } from './image-preview';

const file = { viewKey: 'view', fileKey: 'image', targetId: 'version' };
const scope = { projectId: 'project', conversationId: 'conversation' };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function fixture() {
  const image = {
    blob: new Blob(['image'], { type: 'image/webp' }),
    fileName: 'image.webp',
  };
  const client = {
    readFilePreview: vi.fn<NonNullable<ImagePreviewClient['readFilePreview']>>(
      async () => image,
    ),
    createFileAccessSession: vi.fn(async () => ({
      sessionId: 'session',
      expiresAt: '2099-01-01T00:00:00Z',
    })),
    createFileAccessGrant: vi.fn(async () => ({
      url: '/authorized',
      fileName: 'image.png',
      mimeType: 'image/png',
      expiresAt: '2099-01-01T00:00:00Z',
    })),
    readFileAccess: vi.fn(
      async () => new Blob(['original'], { type: 'image/png' }),
    ),
    revokeFileAccessSession: vi.fn(async () => undefined),
  };
  return {
    client,
    image,
    read: (variant: 'original' | 'thumbnail' = 'thumbnail') =>
      loadImagePreview(
        client,
        'assistant',
        scope,
        file,
        new AbortController().signal,
        variant,
      ),
  };
}

describe('single-request image previews', () => {
  it('uses thumbnails for inline images and explicitly requests originals without creating grants', async () => {
    const f = fixture();
    expect(await f.read()).toBe(f.image);
    expect(await f.read('original')).toBe(f.image);
    expect(f.client.readFilePreview.mock.calls).toEqual([
      [
        'agent',
        'assistant',
        'view',
        { fileKey: 'image', targetId: 'version', variant: 'thumbnail' },
        { runtimeScope: scope, signal: expect.any(AbortSignal) },
      ],
      [
        'agent',
        'assistant',
        'view',
        { fileKey: 'image', targetId: 'version', variant: 'original' },
        { runtimeScope: scope, signal: expect.any(AbortSignal) },
      ],
    ]);
    expect(f.client.createFileAccessSession).not.toHaveBeenCalled();
    expect(f.client.createFileAccessGrant).not.toHaveBeenCalled();
  });

  it.each([404, 405, 501])(
    'keeps authenticated legacy fallback on an old server (%s)',
    async (status) => {
      const f = fixture();
      f.client.readFilePreview.mockRejectedValue({ status });
      expect((await f.read()).blob.type).toBe('image/png');
      expect(f.client.createFileAccessGrant).toHaveBeenCalledWith(
        'session',
        { fileKey: 'image', targetId: 'version', purpose: 'preview' },
        expect.anything(),
      );
    },
  );

  it.each([401, 403, 413, 415, 429, 503])(
    'never bypasses a rejection (%s) with legacy file access',
    async (status) => {
      const f = fixture();
      f.client.readFilePreview.mockRejectedValue({ status });
      await expect(f.read()).rejects.toEqual({ status });
      expect(f.client.createFileAccessSession).not.toHaveBeenCalled();
    },
  );

  it('rejects a non-image payload even when the endpoint returns success', async () => {
    const f = fixture();
    f.client.readFilePreview.mockResolvedValue({
      blob: new Blob(['html'], { type: 'text/html' }),
      fileName: 'image.png',
    });
    await expect(f.read()).rejects.toThrow('Resource file unavailable');
    expect(f.client.createFileAccessSession).not.toHaveBeenCalled();
  });

  it('shares concurrent identical reads but isolates clients, project scopes, targets and variants', async () => {
    const f = fixture();
    const other = fixture();
    let finish!: (value: typeof f.image) => void;
    f.client.readFilePreview.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const a = f.read();
    const b = f.read();
    await flush();
    expect(f.client.readFilePreview).toHaveBeenCalledTimes(1);
    await other.read();
    await loadImagePreview(
      f.client,
      'assistant',
      { ...scope, projectId: 'other' },
      file,
      new AbortController().signal,
      'thumbnail',
    );
    await loadImagePreview(
      f.client,
      'assistant',
      scope,
      { ...file, targetId: 'other-version' },
      new AbortController().signal,
      'thumbnail',
    );
    await f.read('original');
    expect(f.client.readFilePreview).toHaveBeenCalledTimes(4);
    finish(f.image);
    await Promise.all([a, b]);
    await f.read();
    expect(f.client.readFilePreview).toHaveBeenCalledTimes(5);
  });

  it('limits a gallery to four active image requests and cancels queued work on scope disposal', async () => {
    const f = fixture();
    const active: AbortSignal[] = [];
    f.client.readFilePreview = vi.fn(
      (_host, _id, _view, _request, options) =>
        new Promise((_resolve, reject) => {
          const signal = options?.signal;
          if (!signal) throw new Error('Missing request cancellation');
          active.push(signal);
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('Cancelled', 'AbortError')),
            { once: true },
          );
        }),
    );
    const controller = new AbortController();
    const results = Promise.allSettled(
      Array.from({ length: 30 }, (_, index) =>
        loadImagePreview(
          f.client,
          'assistant',
          scope,
          { ...file, fileKey: `image-${index}` },
          controller.signal,
          'thumbnail',
        ),
      ),
    );
    await flush();
    expect(active).toHaveLength(4);
    controller.abort();
    expect(
      (await results).every((result) => result.status === 'rejected'),
    ).toBe(true);
    await flush();
    expect(active).toHaveLength(4);
    expect(active.every((signal) => signal.aborted)).toBe(true);
  });
});
