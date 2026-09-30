import { describe, expect, it } from 'vitest';
import { createSdkRequestHook } from './client-secret';

describe('SDK Workbench authentication', () => {
  it('provides current credentials to the SDK hook before any HTTP fetch', () => {
    let credentials = { secret: 'cs-x-first', organizationId: 'org-first' };
    const onRequest = createSdkRequestHook(() => credentials);
    const socketUrl = new URL('https://example.test/api');
    const first = new Headers(onRequest(socketUrl, {}).headers);
    expect(first.get('Authorization')).toBe('Bearer cs-x-first');
    expect(first.get('x-api-key')).toBe('cs-x-first');
    expect(first.get('organization-id')).toBe('org-first');
    credentials = { secret: 'cs-x-refreshed', organizationId: 'org-next' };
    const refreshed = new Headers(onRequest(socketUrl, {}).headers);
    expect(refreshed.get('Authorization')).toBe('Bearer cs-x-refreshed');
    expect(refreshed.get('x-api-key')).toBe('cs-x-refreshed');
    expect(refreshed.get('organization-id')).toBe('org-next');
  });

  it('preserves request headers and only attaches stream resume IDs to stream requests', () => {
    const onRequest = createSdkRequestHook(
      () => ({ secret: 'cs-x-test', organizationId: 'org' }),
      () => 'event-7',
    );
    const input = { headers: { 'Accept-Language': 'zh-CN' } };
    const stream = new Headers(
      onRequest(
        new URL('https://example.test/api/ai/threads/1/runs/stream'),
        input,
      ).headers,
    );
    expect(stream.get('Last-Event-ID')).toBe('event-7');
    expect(stream.get('Accept-Language')).toBe('zh-CN');
    expect(stream.get('Authorization')).toBe('Bearer cs-x-test');
    expect(input.headers).toEqual({ 'Accept-Language': 'zh-CN' });
    const socketHeaders = new Headers(
      onRequest(new URL('https://example.test/api'), input).headers,
    );
    expect(socketHeaders.get('Last-Event-ID')).toBeNull();
  });

  it('removes stale authentication and organization headers when credentials are cleared', () => {
    const onRequest = createSdkRequestHook(() => ({ secret: '' }));
    const headers = new Headers(
      onRequest(new URL('https://example.test/api'), {
        headers: {
          Authorization: 'Bearer stale',
          'x-api-key': 'stale',
          'organization-id': 'stale-org',
        },
      }).headers,
    );
    expect(headers.get('Authorization')).toBeNull();
    expect(headers.get('x-api-key')).toBeNull();
    expect(headers.get('organization-id')).toBeNull();
  });
});
