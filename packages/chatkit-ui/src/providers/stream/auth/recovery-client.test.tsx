import { renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useStreamCredentials } from './useStreamCredentials';

afterEach(() => vi.unstubAllGlobals());
it('uses one SDK attempt for recovery reads with the same authentication and organization', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    new Response('Unavailable', {
      status: 503,
      headers: { 'Retry-After': '30' },
    }),
  );
  vi.stubGlobal('fetch', fetch);
  const view = renderHook(() =>
    useStreamCredentials({
      apiKey: 'cs-x-test',
      organizationId: 'org-test',
      apiUrl: 'https://recovery.test',
      locale: 'zh-CN',
      isParentAvailable: false,
      getClientSecret: undefined,
      sendCommand: vi.fn(),
      lastEventIdRef: { current: null },
      clientRef: { current: null },
    }),
  );
  await expect(
    view.result.current.readClient.threads.get('thread'),
  ).rejects.toMatchObject({ status: 503, retryAfterMs: 30_000 });
  expect(fetch).toHaveBeenCalledTimes(1);
  const headers = new Headers(fetch.mock.calls[0][1]?.headers);
  expect(headers.get('authorization')).toBe('Bearer cs-x-test');
  expect(headers.get('organization-id')).toBe('org-test');
  view.unmount();
});
