import { Client } from '@xpert-ai/xpert-sdk';
import { describe, expect, it, vi } from 'vitest';

// Guards the installed SDK contract: ChatKit must not rewrite service routes.
describe('SDK runtime routing used by ChatKit', () => {
  it.each([
    'https://xpert.example/api/ai',
    'https://xpert.example/prefix/api/ai/',
  ])(
    'uses AI routes and session credentials with a plain Client (%s)',
    async (apiUrl) => {
      const fetchMock = vi.fn<typeof fetch>().mockImplementation(
        async () =>
          new Response('{}', {
            headers: { 'content-type': 'application/json' },
          }),
      );
      const client = new Client({
        apiUrl,
        callerOptions: { fetch: fetchMock },
        defaultHeaders: { language: 'zh-Hans' },
        onRequest: (_url, init) => {
          const headers = new Headers(init.headers);
          headers.set('Authorization', 'Bearer cs-x-test');
          return { ...init, headers };
        },
      });
      await client.sandbox.listThreadServices('thread/id', {
        organizationId: 'org',
      });
      await client.sandbox.stopThreadService('thread/id', 'service/id');
      await client.threads.get('thread');

      const base = apiUrl.replace(/\/+$/, '');
      expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
        `${base}/sandbox/threads/thread%2Fid/services?organizationId=org`,
        `${base}/sandbox/threads/thread%2Fid/services/service%2Fid/stop`,
        `${base}/threads/thread`,
      ]);
      expect(fetchMock.mock.calls[1][1]?.method).toBe('POST');
      for (const [, init] of fetchMock.mock.calls) {
        expect(new Headers(init?.headers).get('Authorization')).toBe(
          'Bearer cs-x-test',
        );
        expect(new Headers(init?.headers).get('language')).toBe('zh-Hans');
      }
    },
  );
});
