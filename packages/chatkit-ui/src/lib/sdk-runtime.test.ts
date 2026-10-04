import { Client } from '@xpert-ai/xpert-sdk';
import { describe, expect, it, vi } from 'vitest';

// Guards the installed SDK contract: ChatKit must not rewrite service routes.
describe('SDK runtime routing used by ChatKit', () => {
  it.each([
    'https://xpert.example/api/ai',
    'https://xpert.example/prefix/api/ai/',
  ])(
    'loads Workbench files and saved artifacts through the installed SDK (%s)',
    async (apiUrl) => {
      const html = '<!doctype html><title>Saved artifact</title>';
      const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (url) =>
        String(url).endsWith('/content')
          ? new Response(html, {
              headers: { 'content-type': 'text/html' },
            })
          : new Response('[]', {
              headers: { 'content-type': 'application/json' },
            }),
      );
      const client = new Client({
        apiUrl,
        callerOptions: { fetch: fetchMock },
        onRequest: (_url, init) => {
          const headers = new Headers(init.headers);
          headers.set('Authorization', 'Bearer cs-workbench-test');
          headers.set('organization-id', 'test-org');
          return { ...init, headers };
        },
      });

      expect(
        await client.workbench.listFiles(
          { kind: 'assistant', assistantId: 'assistant/id' },
          'pages',
        ),
      ).toEqual([]);
      expect(
        await client.workbench.listFiles(
          { kind: 'conversation', conversationId: 'conversation/id' },
          'pages',
        ),
      ).toEqual([]);
      const artifact = await client.workbench.downloadArtifact(
        'conversation/id',
        { artifactId: 'artifact/id', artifactVersionId: 'version/id' },
      );
      expect(artifact.type).toBe('text/html');
      expect(await artifact.text()).toBe(html);
      const base = apiUrl.replace(/\/+$/, '');
      expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
        `${base}/assistants/assistant%2Fid/workspace/files?path=pages`,
        `${base}/conversations/conversation%2Fid/files?path=pages`,
        `${base}/conversations/conversation%2Fid/artifacts/artifact%2Fid/versions/version%2Fid/content`,
      ]);
      for (const [, init] of fetchMock.mock.calls) {
        const headers = new Headers(init?.headers);
        expect(headers.get('Authorization')).toBe('Bearer cs-workbench-test');
        expect(headers.get('organization-id')).toBe('test-org');
      }
    },
  );

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
