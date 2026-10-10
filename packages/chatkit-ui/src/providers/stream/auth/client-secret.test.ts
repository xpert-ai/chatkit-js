import { normalizeRequestLanguage } from '@xpert-ai/chatkit-types';
import { describe, expect, it, vi } from 'vitest';
import { normalizeClientSecretResult } from '../../../lib/client-secret';
import {
  createFetchWithClientSecretRefresh,
  createLanguageHeaders,
} from '../../Stream';

describe('request language headers', () => {
  it('normalizes ChatKit locales to Xpert language headers', () => {
    expect(normalizeRequestLanguage('zh-CN')).toBe('zh-Hans');
    expect(normalizeRequestLanguage('zh-Hans')).toBe('zh-Hans');
    expect(normalizeRequestLanguage('zh-TW')).toBe('zh-Hant');
    expect(normalizeRequestLanguage('en-US')).toBe('en');
    expect(normalizeRequestLanguage('fr-FR')).toBe('fr-FR');
  });

  it('creates both Language and Accept-Language headers', () => {
    expect(createLanguageHeaders('zh-Hans')).toEqual({
      Language: 'zh-Hans',
      'Accept-Language': 'zh-Hans',
    });
    expect(createLanguageHeaders(null)).toBeUndefined();
  });
});

describe('createFetchWithClientSecretRefresh', () => {
  it('adds the organization header to the initial request', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 200 }));
    const request = createFetchWithClientSecretRefresh({
      fetchFn,
      getCurrentClientSecret: () => ({
        secret: 'cs-x-current',
        organizationId: 'org-1',
      }),
      refreshClientSecret: vi.fn(),
    });

    await request('https://example.com/test', {
      headers: {
        'x-trace-id': 'trace-1',
      },
    });

    const headers = new Headers(fetchFn.mock.calls[0]?.[1]?.headers);
    expect(headers.get('Authorization')).toBe('Bearer cs-x-current');
    expect(headers.get('x-api-key')).toBe('cs-x-current');
    expect(headers.get('organization-id')).toBe('org-1');
    expect(headers.get('x-trace-id')).toBe('trace-1');
  });

  it('retries a 401 with the refreshed secret and organization id', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const refreshClientSecret = vi.fn().mockResolvedValue({
      secret: 'cs-x-refreshed',
      organizationId: 'org-2',
    });
    const request = createFetchWithClientSecretRefresh({
      fetchFn,
      getCurrentClientSecret: () => ({
        secret: 'cs-x-current',
        organizationId: 'org-1',
      }),
      refreshClientSecret,
    });

    const response = await request('https://example.com/test');

    expect(response.status).toBe(200);
    expect(refreshClientSecret).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    const retryHeaders = new Headers(fetchFn.mock.calls[1]?.[1]?.headers);
    expect(retryHeaders.get('Authorization')).toBe('Bearer cs-x-refreshed');
    expect(retryHeaders.get('x-api-key')).toBe('cs-x-refreshed');
    expect(retryHeaders.get('organization-id')).toBe('org-2');
  });

  it('keeps the current organization id when refresh normalization uses the legacy string response', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const request = createFetchWithClientSecretRefresh({
      fetchFn,
      getCurrentClientSecret: () => ({
        secret: 'cs-x-current',
        organizationId: 'org-current',
      }),
      refreshClientSecret: async () =>
        normalizeClientSecretResult('cs-x-refreshed', 'org-current'),
    });

    await request('https://example.com/test');

    const retryHeaders = new Headers(fetchFn.mock.calls[1]?.[1]?.headers);
    expect(retryHeaders.get('Authorization')).toBe('Bearer cs-x-refreshed');
    expect(retryHeaders.get('organization-id')).toBe('org-current');
  });

  it('returns the original 401 response when refresh fails', async () => {
    const originalResponse = new Response(null, { status: 401 });
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(originalResponse);
    const request = createFetchWithClientSecretRefresh({
      fetchFn,
      getCurrentClientSecret: () => ({
        secret: 'cs-x-current',
        organizationId: 'org-1',
      }),
      refreshClientSecret: vi
        .fn()
        .mockRejectedValue(new Error('refresh failed')),
    });

    const response = await request('https://example.com/test');

    expect(response).toBe(originalResponse);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('credential readiness and request cancellation', () => {
  it('waits for credentials before sending the first request', async () => {
    const pending = deferred<{ secret: string; organizationId: string }>();
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response());
    const request = createFetchWithClientSecretRefresh({
      fetchFn,
      getCurrentClientSecret: () => ({ secret: '' }),
      refreshClientSecret: () => pending.promise,
    });
    const response = request('https://example.test');
    expect(fetchFn).not.toHaveBeenCalled();
    pending.resolve({ secret: 'cs-x-ready', organizationId: 'org-ready' });
    expect((await response).status).toBe(200);
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(
      new Headers(fetchFn.mock.calls[0][1]?.headers).get('organization-id'),
    ).toBe('org-ready');
  });

  it('does not send a request when initialization fails', async () => {
    const fetchFn = vi.fn<typeof fetch>();
    const request = createFetchWithClientSecretRefresh({
      fetchFn,
      getCurrentClientSecret: () => ({ secret: '' }),
      refreshClientSecret: async () => {
        throw new Error('Host unavailable');
      },
    });
    await expect(request('https://example.test')).rejects.toThrow(
      'Host unavailable',
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('cancels one waiter promptly without cancelling a refresh needed by another', async () => {
    const pending = deferred<{ secret: string }>();
    const controller = new AbortController();
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response());
    const request = createFetchWithClientSecretRefresh({
      fetchFn,
      getCurrentClientSecret: () => ({ secret: '' }),
      refreshClientSecret: () => pending.promise,
    });
    const cancelled = request('https://example.test/old', {
      signal: controller.signal,
    });
    const active = request('https://example.test/current');
    const rejection = expect(cancelled).rejects.toMatchObject({
      name: 'AbortError',
    });
    controller.abort();
    await rejection;
    expect(fetchFn).not.toHaveBeenCalled();
    pending.resolve({ secret: 'cs-x-ready' });
    await active;
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(fetchFn.mock.calls[0][0]).toBe('https://example.test/current');
  });

  it('does not refresh or send an already cancelled request', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchFn = vi.fn<typeof fetch>();
    const refresh = vi.fn();
    const request = createFetchWithClientSecretRefresh({
      fetchFn,
      getCurrentClientSecret: () => ({ secret: '' }),
      refreshClientSecret: refresh,
    });
    await expect(
      request('https://example.test', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(refresh).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('does not retry or warn when the consumer aborts during 401 refresh', async () => {
    const pending = deferred<{ secret: string }>();
    const controller = new AbortController();
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 401 }));
    const refresh = vi.fn(() => pending.promise);
    const warning = vi.fn();
    const request = createFetchWithClientSecretRefresh({
      fetchFn,
      getCurrentClientSecret: () => ({ secret: 'cs-x-old' }),
      refreshClientSecret: refresh,
      onRefreshError: warning,
    });
    const response = request('https://example.test', {
      signal: controller.signal,
    });
    const rejection = expect(response).rejects.toMatchObject({
      name: 'AbortError',
    });
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    controller.abort();
    await rejection;
    pending.resolve({ secret: 'cs-x-new' });
    await pending.promise;
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(warning).not.toHaveBeenCalled();
  });

  it('reuses rotated credentials for a late 401 instead of refreshing again', async () => {
    const first = deferred<Response>();
    let secret = 'cs-x-old';
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(new Response());
    const refresh = vi.fn();
    const request = createFetchWithClientSecretRefresh({
      fetchFn,
      getCurrentClientSecret: () => ({ secret }),
      refreshClientSecret: refresh,
    });
    const response = request('https://example.test');
    secret = 'cs-x-new';
    first.resolve(new Response(null, { status: 401 }));
    await response;
    expect(refresh).not.toHaveBeenCalled();
    expect(
      new Headers(fetchFn.mock.calls[1][1]?.headers).get('Authorization'),
    ).toBe('Bearer cs-x-new');
  });

  it('propagates a retry transport failure without calling it a refresh failure', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockRejectedValueOnce(new TypeError('Network failed'));
    const warning = vi.fn();
    const request = createFetchWithClientSecretRefresh({
      fetchFn,
      getCurrentClientSecret: () => ({ secret: 'cs-x-old' }),
      refreshClientSecret: async () => ({ secret: 'cs-x-new' }),
      onRefreshError: warning,
    });
    await expect(request('https://example.test')).rejects.toThrow(
      'Network failed',
    );
    expect(warning).not.toHaveBeenCalled();
  });

  it('cancels in-flight SDK requests when their Assistant scope is disposed', async () => {
    const controller = new AbortController();
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason),
          );
        }),
    );
    const refresh = vi.fn();
    const request = createFetchWithClientSecretRefresh({
      fetchFn,
      getScopeSignal: () => controller.signal,
      getCurrentClientSecret: () => ({ secret: 'cs-x-old' }),
      refreshClientSecret: refresh,
    });
    const response = request('https://example.test');
    const rejection = expect(response).rejects.toMatchObject({
      name: 'AbortError',
    });
    controller.abort();
    await rejection;
    expect(refresh).not.toHaveBeenCalled();
  });
});

it('coalesces concurrent 401 refreshes across SDK calls and does not renew after 403', async () => {
  let current = { secret: 'cs-x-old' };
  let finish!: (value: { secret: string }) => void;
  const refresh = vi.fn(
    () =>
      new Promise<{ secret: string }>((resolve) => {
        finish = resolve;
      }),
  );
  const fetchFn = vi.fn<typeof fetch>(
    async (_input, init) =>
      new Response(null, {
        status:
          new Headers(init?.headers).get('Authorization') === 'Bearer cs-x-old'
            ? 401
            : 200,
      }),
  );
  const request = createFetchWithClientSecretRefresh({
    fetchFn,
    getCurrentClientSecret: () => current,
    refreshClientSecret: refresh,
  });
  const first = request('https://example.test/groups/D');
  const second = request('https://example.test/groups/D/messages');
  await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  current = { secret: 'cs-x-new' };
  finish(current);
  expect((await first).status).toBe(200);
  expect((await second).status).toBe(200);
  fetchFn.mockResolvedValueOnce(new Response(null, { status: 403 }));
  expect((await request('https://example.test/groups/D')).status).toBe(403);
  expect(refresh).toHaveBeenCalledTimes(1);
});
