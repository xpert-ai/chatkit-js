import { Client } from '@xpert-ai/xpert-sdk';
import { describe, expect, it, vi } from 'vitest';

// Exercise the published SDK as well as the UI mocks: granted content must use
// its server-issued route while retaining the trusted host's SDK transport.
describe('installed SDK preview transport', () => {
  it('reads content from the grant route while retaining the configured transport', async () => {
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
    });
    const blob = await client.viewHosts.readFileAccess(grantUrl);
    expect(String(fetch.mock.calls[0]?.[0])).toBe(grantUrl);
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      credentials: 'include',
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
