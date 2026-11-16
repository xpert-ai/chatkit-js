import { describe, expect, it, vi } from 'vitest';
import { loadResourceCardFileMetadata } from './metadata';

const file = { viewKey: 'documents', fileKey: 'opaque', targetId: 'version' };
const scope = { projectId: 'project' };
function fixture() {
  return {
    createFileAccessSession: vi.fn(async () => ({
      sessionId: 'session',
      expiresAt: '2099-01-01T00:00:00Z',
    })),
    createFileAccessGrant: vi.fn(async () => ({
      url: '/private-download',
      fileName: 'report.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      expiresAt: '2099-01-01T00:00:00Z',
    })),
    revokeFileAccessSession: vi.fn(async () => undefined),
    readFileAccess: vi.fn(),
  };
}
describe('resource file icon metadata', () => {
  it('resolves only MIME through scoped authorization and releases the unused grant', async () => {
    const client = fixture(),
      signal = new AbortController().signal;
    const metadata = await loadResourceCardFileMetadata(
      client,
      'assistant',
      scope,
      file,
      signal,
    );
    expect(metadata).toEqual({
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    expect(client.createFileAccessSession).toHaveBeenCalledWith(
      'agent',
      'assistant',
      'documents',
      { runtimeScope: scope, signal },
    );
    expect(client.createFileAccessGrant).toHaveBeenCalledWith(
      'session',
      {
        fileKey: 'opaque',
        targetId: 'version',
        purpose: 'download',
      },
      { runtimeScope: scope, signal },
    );
    expect(client.readFileAccess).not.toHaveBeenCalled();
    expect(client.revokeFileAccessSession).toHaveBeenCalledWith('session');
  });
  it.each(['denied', 'expired', 'aborted'] as const)(
    'releases metadata access on %s',
    async (reason) => {
      const client = fixture(),
        controller = new AbortController();
      const grant = await client.createFileAccessGrant();
      client.createFileAccessGrant.mockImplementation(async () => {
        if (reason === 'denied') throw new Error('Forbidden');
        if (reason === 'aborted') controller.abort();
        return {
          ...grant,
          expiresAt: reason === 'expired' ? 'invalid' : grant.expiresAt,
        };
      });
      await expect(
        loadResourceCardFileMetadata(
          client,
          'assistant',
          scope,
          file,
          controller.signal,
        ),
      ).rejects.toThrow();
      expect(client.readFileAccess).not.toHaveBeenCalled();
      expect(client.revokeFileAccessSession).toHaveBeenCalledWith('session');
    },
  );
});
