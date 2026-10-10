import { Client } from '@xpert-ai/xpert-sdk';
import { describe, expect, it, vi } from 'vitest';

// Exercise the published SDK as well as the UI mocks: granted content must use
// the authenticated grant route while retaining the trusted host's SDK transport.
describe('installed SDK preview transport', () => {
  it('reads content through the runtime route without cookies while retaining the configured transport', async () => {
    const grantUrl =
      'https://platform.example/api/workspace-files/content/session/grant/proof.png';
    const bytes = new Uint8Array([137, 80, 78, 71, 0, 255]);
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(bytes, {
        headers: { 'Content-Type': 'image/png' },
      }),
    );
    const client = new Client({
      apiUrl: 'https://platform.example/api/ai',
      callerOptions: { fetch, maxRetries: 0 },
      onRequest: (_url, init) => {
        const headers = new Headers(init.headers);
        headers.set('Authorization', 'Bearer cs-preview-test');
        return { ...init, headers };
      },
    });
    const blob = await client.viewHosts.readFileAccess(grantUrl);
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      'https://platform.example/api/ai/workspace-files/view-sessions/session/grants/grant/content/proof.png',
    );
    expect(
      new Headers(fetch.mock.calls[0]?.[1]?.headers).get('Authorization'),
    ).toBe('Bearer cs-preview-test');
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      credentials: 'omit',
      redirect: 'error',
    });
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
    expect(blob.type).toBe('image/png');
    await expect(
      client.viewHosts.readFileAccess(
        'https://foreign.example/api/workspace-files/content/session/grant/proof.png',
      ),
    ).rejects.toThrow('Invalid workspace');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
