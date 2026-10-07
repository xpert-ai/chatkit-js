import { Client } from '@xpert-ai/xpert-sdk';
import { expect, it, vi } from 'vitest';

it('the installed SDK sends a bodyless pause and keeps legacy display data out of the control channel', async () => {
  const accepted = { executionId: 'run', state: 'pausing', pauseId: 'token' };
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify(accepted)));
  const client = new Client({ apiUrl: 'https://example.test/api/ai', callerOptions: { fetch } });
  const legacy = { displaySnapshot: 'x'.repeat(2_800_000) };
  expect(await client.runs.pause('thread', 'run', { ...legacy, pollTimeoutMs: 0 })).toEqual(accepted);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][1]?.method).toBe('POST');
  expect(fetch.mock.calls[0][1]?.body).toBeUndefined();
});
