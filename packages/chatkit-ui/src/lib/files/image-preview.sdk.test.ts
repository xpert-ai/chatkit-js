import { Client } from '@xpert-ai/xpert-sdk';
import { describe, expect, it } from 'vitest';
import { loadImagePreview, type ImagePreviewClient } from './image-preview';

// Run with the installed SDK in CI and the companion SDK build during rollout verification.
describe('image previews through the real SDK and browser binary objects', () => {
  it('uses the available SDK transport, preserves scope and returns exact bytes', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const bytes = new Uint8Array([137, 80, 78, 71, 0, 255]);
    const imageResponse = () =>
      new Response(bytes, {
        headers: {
          'content-type': 'image/png',
          'content-disposition': "inline; filename*=UTF-8''%E5%9B%BE.png",
        },
      });
    const client = new Client({
      apiUrl: 'https://example.test/api/ai',
      defaultHeaders: {
        authorization: 'Bearer fixture',
        'organization-id': 'org',
        'tenant-id': 'tenant',
      },
      callerOptions: {
        maxRetries: 0,
        fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
          const path = String(url);
          requests.push({ url: path, init });
          if (path.endsWith('/preview') || path.endsWith('/content/image.png'))
            return imageResponse();
          if (init?.method === 'DELETE')
            return Response.json({ success: true });
          if (path.endsWith('/grants'))
            return Response.json({
              url: '/api/workspace-files/content/session/grant/image.png',
              fileName: '图.png',
              mimeType: 'image/png',
              expiresAt: '2099-01-01T00:00:00Z',
            });
          if (path.endsWith('/view-sessions'))
            return Response.json({
              sessionId: 'session',
              expiresAt: '2099-01-01T00:00:00Z',
            });
          throw new Error(`Unexpected SDK route ${path}`);
        },
      },
    });
    const scope = { projectId: 'project', conversationId: 'conversation' };
    const result = await loadImagePreview(
      client.viewHosts,
      'assistant',
      scope,
      { viewKey: 'gallery', fileKey: 'image' },
      new AbortController().signal,
      'thumbnail',
    );
    expect(new Uint8Array(await result.blob.arrayBuffer())).toEqual(bytes);
    expect(result.fileName).toBe('图.png');
    const direct =
      typeof (client.viewHosts as ImagePreviewClient).readFilePreview ===
      'function';
    expect(
      requests.filter(({ init }) => init?.method !== 'DELETE'),
    ).toHaveLength(direct ? 1 : 3);
    expect(JSON.parse(String(requests[0].init?.body))).toMatchObject({
      hostType: 'agent',
      hostId: 'assistant',
      viewKey: 'gallery',
      runtimeScope: scope,
      ...(direct ? { fileKey: 'image', variant: 'thumbnail' } : {}),
    });
    for (const { init } of requests) {
      const headers = new Headers(init?.headers);
      expect(headers.get('organization-id')).toBe('org');
      expect(headers.get('tenant-id')).toBe('tenant');
      expect(headers.get('authorization')).toBeTruthy();
    }
  });
});
