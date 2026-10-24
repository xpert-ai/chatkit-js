import { describe, expect, it, vi } from 'vitest';
import {
  executeWorkbenchCommand,
  type WorkbenchCommandHost,
} from './client-commands';
import { FileAccessUrls } from './remote-view/file-access-urls';
import type { WorkbenchPreview } from './preview/types';

const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
function fixture() {
  const previews: WorkbenchPreview[] = [];
  const host: WorkbenchCommandHost = {
    apiUrl: 'https://xpert.example/api/ai',
    openView: () => false,
    openPreview: (preview) => previews.push(preview),
    revealChat: vi.fn(),
    updateComposer: vi.fn(),
    focusComposer: vi.fn(),
    forward: vi.fn(),
  };
  return {
    previews,
    execute: (commandKey: string, payload: unknown) =>
      executeWorkbenchCommand(
        {
          commandKey,
          payload,
          hostType: 'agent',
          hostId: 'assistant',
          viewKey: 'company-assets',
        },
        host,
      ),
  };
}

describe('inline file grants returned by the remote view host', () => {
  it('opens the exact granted image bytes using the local file viewer', async () => {
    const bytes = Uint8Array.from(atob(png), (character) =>
      character.charCodeAt(0),
    );
    const blob = await new Response(bytes, {
      headers: { 'Content-Type': 'image/png' },
    }).blob();
    const grant = await new FileAccessUrls({
      readFileAccess: vi.fn().mockResolvedValue(blob),
    }).create(
      {
        url: 'https://xpert.example/api/workspace-files/content/session/grant/proof.png',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        fileName: 'proof.png',
        mimeType: 'image/png',
      },
      new AbortController().signal,
    );
    const { previews, execute } = fixture();
    const payload = {
      id: 'proof',
      name: grant.fileName,
      url: grant.url,
      mimeType: grant.mimeType,
    };
    expect(await execute('workbench.file.open', payload)).toMatchObject({
      success: true,
      status: 'opened',
    });
    const preview = previews[0];
    expect(preview.kind).toBe('resource-file');
    expect(preview.key).not.toContain('data:');
    if (preview.kind !== 'resource-file')
      throw new Error('Expected a local file preview');
    const loaded = await preview.source.load(new AbortController().signal);
    expect(loaded.fileName).toBe('proof.png');
    expect(loaded.blob.type).toBe('image/png');
    expect(new Uint8Array(await loaded.blob.arrayBuffer())).toEqual(bytes);
    await execute('workbench.file.open', payload);
    expect(previews[1].key).toBe(preview.key);
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(preview.source.load(cancelled.signal)).rejects.toThrow();
  });

  it.each([
    { url: 'data:text/html;base64,PGgxPnByb29mPC9oMT4=', name: 'proof.png' },
    { url: 'data:text/html;base64,PHN2Zz48L3N2Zz4=', name: 'proof.pdf' },
    { url: 'data:image/png;base64,not valid!', name: 'proof.png' },
    { url: 'data:image/png;base64,a', name: 'proof.png' },
    { url: `data:image/png;base64,${png}`, name: 'proof.html' },
  ])(
    'rejects active, malformed, or conflicting inline file formats',
    async (payload) => {
      const { previews, execute } = fixture();
      expect(await execute('workbench.file.open', payload)).toMatchObject({
        code: 'bad_request',
      });
      expect(previews).toHaveLength(0);
    },
  );

  it.each([
    ['proof.pdf', 'application/pdf', '%PDF-1.7\n%%EOF'],
    ['note.md', 'text/markdown', '# Notes\n正文'],
    ['proof.svg', 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"/>'],
    ['page.html', 'text/html', '<h1>Preview</h1>'],
    ['data.csv', 'text/csv', 'name,value\nrow,1'],
    ['unknown.bin', 'application/octet-stream', 'download only'],
  ])(
    'routes %s through the shared file viewer',
    async (name, mimeType, content) => {
      const bytes = Uint8Array.from(new TextEncoder().encode(content));
      const url = `data:${mimeType};base64,${btoa(String.fromCharCode(...bytes))}`;
      const { previews, execute } = fixture();
      expect(await execute('workbench.file.open', { name, url })).toMatchObject(
        { success: true },
      );
      const preview = previews[0];
      if (preview.kind !== 'resource-file')
        throw new Error('Expected shared file preview');
      const loaded = await preview.source.load(new AbortController().signal);
      expect(new Uint8Array(await loaded.blob.arrayBuffer())).toEqual(bytes);
      expect(loaded.blob.type).toBe(mimeType);
      expect(loaded.fileName).toBe(name);
    },
  );

  it('keeps inline content unavailable to the browser navigation command', async () => {
    const { previews, execute } = fixture();
    expect(
      await execute('workbench.browser.open', {
        url: `data:image/png;base64,${png}`,
      }),
    ).toMatchObject({ code: 'bad_request' });
    expect(previews).toHaveLength(0);
  });
});
