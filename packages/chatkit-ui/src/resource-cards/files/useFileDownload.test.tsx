import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useResourceCardFileDownload } from './useFileDownload';
import { downloadBlob } from '../../lib/files/download';

vi.mock('../../lib/files/download', () => ({
  downloadBlob: vi.fn(),
}));

const file = {
  id: 'report',
  title: '报告',
  file: { viewKey: 'bid', fileKey: 'report', targetId: 'project:version' },
};
function fixture() {
  const client = {
    createFileAccessSession: vi.fn(async () => ({
      sessionId: 'session',
      expiresAt: 'future',
    })),
    createFileAccessGrant: vi.fn(async () => ({
      url: '/authorized',
      fileName: '施工报告.pdf',
      mimeType: 'application/pdf',
      expiresAt: 'future',
    })),
    readFileAccess: vi.fn(
      async () => new Blob(['report'], { type: 'application/octet-stream' }),
    ),
    revokeFileAccessSession: vi.fn(async () => undefined),
  };
  const props = {
    client,
    assistantId: 'assistant',
    runtimeScope: { projectId: 'project' },
    available: true,
  };
  return {
    client,
    props,
    ...renderHook(useResourceCardFileDownload, { initialProps: props }),
  };
}

describe('resource file downloads', () => {
  beforeEach(() => vi.clearAllMocks());
  it('downloads only on request using scoped authorization and the server filename/MIME', async () => {
    const f = fixture();
    expect(f.client.createFileAccessSession).not.toHaveBeenCalled();
    await act(() => f.result.current(file));
    expect(f.client.createFileAccessGrant).toHaveBeenCalledWith(
      'session',
      {
        fileKey: 'report',
        targetId: 'project:version',
        purpose: 'download',
      },
      expect.objectContaining({ runtimeScope: f.props.runtimeScope }),
    );
    expect(downloadBlob).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'application/pdf' }),
      '施工报告.pdf',
    );
    expect(f.client.revokeFileAccessSession).toHaveBeenCalledWith('session');
  });
  it('does not read files after a denied grant and can retry', async () => {
    const f = fixture();
    f.client.createFileAccessGrant.mockRejectedValueOnce(
      new Error('Forbidden'),
    );
    await expect(f.result.current(file)).rejects.toThrow('Forbidden');
    expect(f.client.readFileAccess).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(f.client.revokeFileAccessSession).toHaveBeenCalledWith('session');
    await f.result.current(file);
    expect(downloadBlob).toHaveBeenCalledTimes(1);
  });
  it.each(['project change', 'unmount', 'logout'])(
    'cancels pending downloads on %s',
    async (reason) => {
      const f = fixture();
      let resolve!: (blob: Blob) => void;
      f.client.readFileAccess.mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
      const pending = f.result.current(file);
      const rejected = expect(pending).rejects.toThrow();
      await vi.waitFor(() =>
        expect(f.client.readFileAccess).toHaveBeenCalled(),
      );
      if (reason === 'unmount') f.unmount();
      else
        f.rerender({
          ...f.props,
          available: reason !== 'logout',
          runtimeScope: { projectId: 'next' },
        });
      resolve(new Blob(['late']));
      await rejected;
      expect(downloadBlob).not.toHaveBeenCalled();
      expect(f.client.revokeFileAccessSession).toHaveBeenCalledWith('session');
    },
  );
});
