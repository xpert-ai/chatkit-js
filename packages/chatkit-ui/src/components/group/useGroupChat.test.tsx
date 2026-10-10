import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useGroupChat } from './useGroupChat';

const apiUrl = 'https://example.test/api/ai';
afterEach(() => vi.unstubAllGlobals());

it('uses Bearer auth for the group SDK and stops rather than refreshing on forbidden streams', async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response('{}', { status: 403 }));
  vi.stubGlobal('fetch', transport);
  const refresh = vi.fn();
  const { result, unmount } = renderHook(() =>
    useGroupChat({
      groupId: 'D',
      clientSecret: 'cs-x-group',
      refreshClientSecret: refresh,
      options: { api: { apiUrl, getClientSecret: vi.fn() } },
    }),
  );
  await waitFor(() => expect(result.current.error).not.toBeNull());
  const headers = new Headers(transport.mock.calls[0][1]?.headers);
  expect(headers.get('Authorization')).toBe('Bearer cs-x-group');
  expect(headers.has('x-group-session')).toBe(false);
  expect(refresh).not.toHaveBeenCalled();
  expect(result.current.connected).toBe(false);
  unmount();
});

it('cancels old conversation refreshes and keeps the new audience credential isolated', async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockImplementation(async (_input, init) => {
      const secret = new Headers(init?.headers).get('Authorization');
      return new Response('{}', {
        status: secret === 'Bearer cs-x-D' ? 401 : 403,
      });
    });
  vi.stubGlobal('fetch', transport);
  let finish!: (value: { secret: string }) => void;
  const refreshD = vi.fn(
    () =>
      new Promise<{ secret: string }>((resolve) => {
        finish = resolve;
      }),
  );
  const refreshE = vi.fn();
  const { result, rerender, unmount } = renderHook(
    ({ groupId, secret, refresh }) =>
      useGroupChat({
        groupId,
        clientSecret: secret,
        refreshClientSecret: refresh,
        options: { api: { apiUrl, getClientSecret: vi.fn() } },
      }),
    { initialProps: { groupId: 'D', secret: 'cs-x-D', refresh: refreshD } },
  );
  await waitFor(() => expect(refreshD).toHaveBeenCalledTimes(1));
  rerender({ groupId: 'E', secret: 'cs-x-E', refresh: refreshE });
  await waitFor(() => expect(transport).toHaveBeenCalledTimes(2));
  await act(async () => finish({ secret: 'cs-x-stale-D' }));
  await expect(result.current.client.groups.get('E')).rejects.toThrow();
  const headers = new Headers(transport.mock.calls.at(-1)?.[1]?.headers);
  expect(headers.get('Authorization')).toBe('Bearer cs-x-E');
  expect(
    transport.mock.calls.some(
      ([, init]) =>
        new Headers(init?.headers).get('Authorization') ===
        'Bearer cs-x-stale-D',
    ),
  ).toBe(false);
  expect(refreshE).not.toHaveBeenCalled();
  unmount();
});
