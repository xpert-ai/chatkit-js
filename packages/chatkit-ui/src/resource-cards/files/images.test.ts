import { describe, expect, it, vi } from 'vitest';
import { loadResourceCardImage } from './images';

const image = {
  id: 'one',
  title: '平面图',
  file: { viewKey: 'bid', fileKey: 'image', targetId: 'project:version' },
};
function fixture() {
  const client = {
    createFileAccessSession: vi.fn(async () => ({
      sessionId: 'session',
      expiresAt: 'future',
    })),
    createFileAccessGrant: vi.fn(async () => ({
      url: '/authorized',
      fileName: 'image.png',
      mimeType: 'image/png',
      size: 6,
      expiresAt: 'future',
    })),
    readFileAccess: vi.fn(
      async () => new Blob(['pixels'], { type: 'image/png' }),
    ),
    revokeFileAccessSession: vi.fn(async () => undefined),
  };
  const controller = new AbortController();
  const load = () =>
    loadResourceCardImage(
      client,
      'assistant',
      { projectId: 'project', conversationId: 'conversation' },
      image,
      controller.signal,
    );
  return { client, controller, load };
}
describe('resource image file authorization', () => {
  it('resolves a scoped reference with the SDK, reads bytes, then revokes the grant session', async () => {
    const f = fixture();
    expect((await f.load()).type).toBe('image/png');
    expect(f.client.createFileAccessSession).toHaveBeenCalledWith(
      'agent',
      'assistant',
      'bid',
      {
        runtimeScope: { projectId: 'project', conversationId: 'conversation' },
        signal: f.controller.signal,
      },
    );
    expect(f.client.createFileAccessGrant).toHaveBeenCalledWith(
      'session',
      { fileKey: 'image', targetId: 'project:version', purpose: 'preview' },
      expect.anything(),
    );
    expect(f.client.readFileAccess).toHaveBeenCalledWith('/authorized', {
      signal: f.controller.signal,
    });
    expect(f.client.revokeFileAccessSession).toHaveBeenCalledWith('session');
  });
  it('does not fall back to arbitrary URLs after a permission failure', async () => {
    const f = fixture();
    f.client.createFileAccessGrant.mockRejectedValueOnce(
      new Error('Forbidden'),
    );
    await expect(f.load()).rejects.toThrow('Forbidden');
    expect(f.client.readFileAccess).not.toHaveBeenCalled();
    expect(f.client.revokeFileAccessSession).toHaveBeenCalledWith('session');
  });
  it('keeps the thumbnail size limit without downloading oversized images', async () => {
    const f = fixture();
    f.client.createFileAccessGrant.mockResolvedValueOnce({
      url: '/large-image',
      fileName: 'image.png',
      mimeType: 'image/png',
      size: 51 * 1024 * 1024,
      expiresAt: 'future',
    });
    await expect(f.load()).rejects.toThrow('Resource file unavailable');
    expect(f.client.readFileAccess).not.toHaveBeenCalled();
    expect(f.client.revokeFileAccessSession).toHaveBeenCalledWith('session');
  });
  it('rejects non-image content and releases a session after an aborted request', async () => {
    const f = fixture();
    f.client.createFileAccessGrant.mockResolvedValueOnce({
      url: '/html',
      fileName: 'x',
      mimeType: 'text/html',
      size: 1,
      expiresAt: 'future',
    });
    await expect(f.load()).rejects.toThrow('Resource file unavailable');
    expect(f.client.readFileAccess).not.toHaveBeenCalled();
    f.client.createFileAccessSession.mockImplementationOnce(async () => {
      f.controller.abort();
      return { sessionId: 'aborted', expiresAt: 'future' };
    });
    await expect(f.load()).rejects.toThrow();
    expect(f.client.revokeFileAccessSession).toHaveBeenLastCalledWith(
      'aborted',
    );
  });
});
