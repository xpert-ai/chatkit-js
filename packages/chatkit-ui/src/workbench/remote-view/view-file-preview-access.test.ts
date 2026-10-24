import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@xpert-ai/xpert-sdk';
import JSZip from 'jszip';
import { ViewFilePreviewAccess } from './view-file-preview-access';
import {
  executeWorkbenchCommand,
  type WorkbenchCommandHost,
} from '../client-commands';
import type { WorkbenchPreview } from '../preview/types';

const context = {
  hostId: 'assistant',
  viewKey: 'documents',
  runtimeScope: { projectId: 'project', conversationId: 'conversation' },
  isCurrent: () => true,
};
const resource = { fileKey: 'document', targetId: 'file-1' };
const fixture = async (
  name = 'proof.pdf',
  mimeType = 'application/pdf',
  bytes = Uint8Array.from(new TextEncoder().encode('%PDF-1.7\n%%EOF')),
) => {
  const file = await new Response(bytes, {
    headers: { 'Content-Type': mimeType },
  }).blob();
  const client = {
    createFileAccessSession: vi
      .fn<Client['viewHosts']['createFileAccessSession']>()
      .mockResolvedValue({
        sessionId: 'session',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    createFileAccessGrant: vi
      .fn<Client['viewHosts']['createFileAccessGrant']>()
      .mockResolvedValue({
        url: 'https://host.test/private-grant',
        fileName: name,
        mimeType,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    readFileAccess: vi
      .fn<Client['viewHosts']['readFileAccess']>()
      .mockResolvedValue(file),
    revokeFileAccessSession: vi
      .fn<Client['viewHosts']['revokeFileAccessSession']>()
      .mockResolvedValue(undefined),
  };
  return { client, access: new ViewFilePreviewAccess(client), bytes };
};
afterEach(() => vi.restoreAllMocks());

describe('resource-backed View file previews', () => {
  it('reads canonical PDF bytes through the SDK without returning credentials or content to the View', async () => {
    const { client, access, bytes } = await fixture();
    const previews: WorkbenchPreview[] = [];
    const host: WorkbenchCommandHost = {
      apiUrl: 'https://host.test/api',
      openView: () => false,
      openPreview: (preview) => previews.push(preview),
      revealChat: vi.fn(),
      updateComposer: vi.fn(),
      focusComposer: vi.fn(),
      forward: vi.fn(),
      resolveFile: (ref) => access.open(ref, context),
    };
    const result = await executeWorkbenchCommand(
      {
        commandKey: 'workbench.file.open',
        hostType: 'agent',
        hostId: 'assistant',
        viewKey: 'documents',
        payload: {
          resource,
          name: 'spoof.html',
          mimeType: 'text/html',
          url: 'https://untrusted.test',
        },
      },
      host,
    );
    expect(result).toMatchObject({ success: true, status: 'opened' });
    expect(JSON.stringify(result)).not.toMatch(
      /private-grant|session|base64|spoof/,
    );
    expect(client.createFileAccessSession).toHaveBeenCalledWith(
      'agent',
      'assistant',
      'documents',
      expect.objectContaining({ runtimeScope: context.runtimeScope }),
    );
    expect(client.createFileAccessGrant).toHaveBeenCalledWith(
      'session',
      { ...resource, purpose: 'preview' },
      expect.any(Object),
    );
    expect(client.revokeFileAccessSession).toHaveBeenCalledWith('session');
    const preview = previews[0];
    expect(preview.title).toBe('proof.pdf');
    if (preview.kind !== 'resource-file')
      throw new Error('Expected shared preview');
    const loaded = await preview.source.load(new AbortController().signal);
    expect(new Uint8Array(await loaded.blob.arrayBuffer())).toEqual(bytes);
    expect(loaded.blob.type).toBe('application/pdf');
  });

  it.each(['docx', 'xlsx'] as const)(
    'keeps %s ZIP bytes intact for the shared Office renderer',
    async (extension) => {
      const zip = new JSZip();
      zip.file(
        '[Content_Types].xml',
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
      );
      zip.file(
        extension === 'docx' ? 'word/document.xml' : 'xl/workbook.xml',
        '<document/>',
      );
      const bytes = Uint8Array.from(
        await zip.generateAsync({ type: 'uint8array' }),
      );
      const mimeType = `application/vnd.openxmlformats-officedocument.${extension === 'docx' ? 'wordprocessingml.document' : 'spreadsheetml.sheet'}`;
      const { access } = await fixture(`proof.${extension}`, mimeType, bytes);
      const preview = await access.open(resource, context);
      const loaded = await preview.source.load(new AbortController().signal);
      expect(new Uint8Array(await loaded.blob.arrayBuffer())).toEqual(bytes);
      expect(loaded.blob.type).toBe(mimeType);
    },
  );

  it('requests independent download permission and never substitutes preview permission', async () => {
    const { client, access } = await fixture();
    const preview = await access.open(resource, context);
    client.createFileAccessGrant.mockRejectedValueOnce(
      new Error('Forbidden download'),
    );
    await expect(
      preview.source.download(new AbortController().signal),
    ).rejects.toThrow('Forbidden');
    expect(
      client.createFileAccessGrant.mock.calls.map((call) => call[1].purpose),
    ).toEqual(['preview', 'download']);
    expect(client.readFileAccess).toHaveBeenCalledTimes(1);
    expect(client.revokeFileAccessSession).toHaveBeenCalledTimes(2);
  });

  it.each(['grant', 'read'] as const)(
    'revokes the session after a denied %s',
    async (step) => {
      const { client, access } = await fixture();
      (step === 'grant'
        ? client.createFileAccessGrant
        : client.readFileAccess
      ).mockRejectedValueOnce(new Error('Forbidden'));
      await expect(access.open(resource, context)).rejects.toThrow('Forbidden');
      expect(client.revokeFileAccessSession).toHaveBeenCalledOnce();
    },
  );

  it('rejects expired grants before reading their URLs', async () => {
    const { client, access } = await fixture();
    client.createFileAccessGrant.mockResolvedValueOnce({
      url: 'https://host.test/expired',
      fileName: 'proof.pdf',
      mimeType: 'application/pdf',
      expiresAt: '2000-01-01T00:00:00Z',
    });
    await expect(access.open(resource, context)).rejects.toThrow('expired');
    expect(client.readFileAccess).not.toHaveBeenCalled();
    expect(client.revokeFileAccessSession).toHaveBeenCalledOnce();
  });

  it('invalidates preview sources and rejects in-flight reads when the context changes', async () => {
    const { client, access } = await fixture();
    const preview = await access.open(resource, context);
    let finish!: (blob: Blob) => void;
    client.readFileAccess.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const pending = access.open(resource, context);
    await vi.waitFor(() =>
      expect(client.readFileAccess).toHaveBeenCalledTimes(2),
    );
    access.clear();
    finish(new Blob(['late'], { type: 'application/pdf' }));
    await expect(pending).rejects.toThrow();
    await expect(
      preview.source.load(new AbortController().signal),
    ).rejects.toThrow('no longer active');
    await expect(
      preview.source.download(new AbortController().signal),
    ).rejects.toThrow('no longer active');
    expect(client.revokeFileAccessSession).toHaveBeenCalledTimes(2);
  });

  it('does not allow cross-context opens or mismatched active content in a PDF iframe', async () => {
    const { client, access } = await fixture('proof.pdf', 'text/html');
    await expect(
      access.open(resource, { ...context, isCurrent: () => false }),
    ).rejects.toThrow('no longer active');
    expect(client.createFileAccessSession).not.toHaveBeenCalled();
    await expect(access.open(resource, context)).rejects.toThrow(
      'type does not match',
    );
  });

  it('uses different identities for different Views and preserves identity when reopening', async () => {
    const { access } = await fixture();
    const first = await access.open(resource, context);
    expect((await access.open(resource, context)).key).toBe(first.key);
    expect(
      (await access.open(resource, { ...context, viewKey: 'other' })).key,
    ).not.toBe(first.key);
  });
});
