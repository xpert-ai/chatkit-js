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
