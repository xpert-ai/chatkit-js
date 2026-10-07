import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileAccessUrls } from './file-access-urls';

const grant = {
  url: 'https://platform.example/api/workspace-files/content/session/grant/proof.png',
  expiresAt: '2030-01-01T01:00:00Z',
  fileName: '证明图片.png',
  mimeType: 'image/png',
};
const imageBlob = () =>
  new Response('image', { headers: { 'Content-Type': 'image/png' } }).blob();

describe('FileAccessUrls', () => {
  beforeEach(() => {
    // Freeze grant expiry and track timers, but let jsdom FileReader's I/O run.
    vi.useFakeTimers({
      toFake: [
        'Date',
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
      ],
    });
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('encodes exact binary content in a URL usable by an opaque-origin iframe', async () => {
    const bytes = Uint8Array.from({ length: 90_000 }, (_, i) => i % 256);
    const blob = await new Response(bytes, {
      headers: { 'Content-Type': 'image/png' },
    }).blob();
    const client = { readFileAccess: vi.fn().mockResolvedValue(blob) };
    const signal = new AbortController().signal;
    const result = await new FileAccessUrls(client).create(grant, signal);
    expect(client.readFileAccess).toHaveBeenCalledWith(grant.url, { signal });
    expect(result).toMatchObject({
      expiresAt: grant.expiresAt,
      mimeType: grant.mimeType,
      fileName: grant.fileName,
    });
    expect(result.url.startsWith('data:image/png;base64,')).toBe(true);
    expect(
      Uint8Array.from(atob(result.url.split(',')[1]), (c) => c.charCodeAt(0)),
    ).toEqual(bytes);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('discards late reads when the scope changes or the view unmounts', async () => {
    let complete: (blob: Blob) => void = () => {};
    const client = {
      readFileAccess: vi.fn().mockReturnValue(
        new Promise<Blob>((resolve) => {
          complete = resolve;
        }),
      ),
    };
    const previews = new FileAccessUrls(client);
    const pending = previews.create(grant, new AbortController().signal);
    previews.clear();
    complete(await imageBlob());
    await expect(pending).rejects.toThrow('no longer active');
  });

  it('does not return content after request cancellation', async () => {
    const controller = new AbortController();
    const client = {
      readFileAccess: vi.fn().mockImplementation(async () => {
        controller.abort();
        return imageBlob();
      }),
    };
    await expect(
      new FileAccessUrls(client).create(grant, controller.signal),
    ).rejects.toThrow();
  });

  it.each(['2029-01-01T00:00:00Z', 'invalid'])(
    'rejects expired or invalid grants: %s',
    async (expiresAt) => {
      const client = {
        readFileAccess: vi.fn().mockResolvedValue(await imageBlob()),
      };
      await expect(
        new FileAccessUrls(client).create(
          { ...grant, expiresAt },
          new AbortController().signal,
        ),
      ).rejects.toThrow();
    },
  );

  it('propagates denied reads without returning an error page as a preview', async () => {
    const client = {
      readFileAccess: vi.fn().mockRejectedValue(new Error('Forbidden')),
    };
    await expect(
      new FileAccessUrls(client).create(grant, new AbortController().signal),
    ).rejects.toThrow('Forbidden');
  });
});
