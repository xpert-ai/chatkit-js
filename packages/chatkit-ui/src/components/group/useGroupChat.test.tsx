import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useGroupChat } from './useGroupChat';

const apiUrl = 'https://example.test/api/ai';
afterEach(() => vi.unstubAllGlobals());

it('accepts navigation only for a message sent from this client and deduplicates replay', async () => {
  let events!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      events = controller;
    },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation(async (_url, init) =>
      init?.method === 'POST'
        ? new Response(JSON.stringify({ id: 'message' }), { status: 200 })
        : new Response(stream, {
            headers: { 'content-type': 'text/event-stream' },
          }),
    ),
  );
  const { result, unmount } = renderHook(() =>
    useGroupChat({
      groupId: 'g',
      clientSecret: 'secret',
      options: { api: { apiUrl, getClientSecret: vi.fn() } },
    }),
  );
  const request = {
    requestId: crypto.randomUUID(),
    clientMessageId: crypto.randomUUID(),
    referenceId: crypto.randomUUID(),
    projectId: crypto.randomUUID(),
    title: 'Inventory',
  };
  const emit = () =>
    events.enqueue(
      new TextEncoder().encode(
        `event: group\ndata: ${JSON.stringify({ type: 'resource_open', request })}\n\n`,
      ),
    );
  await act(async () => {
    emit();
  });
  await waitFor(() => expect(result.current.connected).toBe(true));
  expect(result.current.resourceRequest).toBeNull();
  await act(async () =>
    result.current.send({
      clientMessageId: request.clientMessageId,
      text: 'Open Inventory',
    }),
  );
  await act(async () => {
    emit();
  });
  await waitFor(() => expect(result.current.resourceRequest).toEqual(request));
  act(() => result.current.consumeResourceRequest(request.requestId));
  await act(async () => {
    emit();
  });
  expect(result.current.resourceRequest).toBeNull();
  unmount();
  events.close();
});

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
