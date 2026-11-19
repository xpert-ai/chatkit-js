import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let origin: string;
const host = `<!doctype html><html><body style="margin:0;height:100vh">
<script src="/web-component.js"></script><script>
const element = document.createElement('xpertai-chatkit');
element.style.cssText='display:block;width:100vw;height:100vh';
const query = new URLSearchParams(location.search);
element.setOptions({ frameUrl:location.origin+'/index.html', initialThread:query.get('thread')||'branch-a',
 api:{apiUrl:location.origin+'/api/ai',xpertId:'assistant',getClientSecret:async()=>({secret:'fixture-secret',organizationId:query.get('org')||'org'})},
 theme:{colorScheme:query.get('dark')?'dark':'light',radius:query.get('dark')?'sharp':'round',density:query.get('dark')?'compact':'spacious'},
 pet:false, history:{enabled:false}, workbench:{enabled:false}
});document.body.append(element);
</script></body></html>`;

let activityServer: Server;
test.beforeAll(async () => {
  activityServer = createServer(async (request, response) => {
    if (request.url?.startsWith('/host')) {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(host);
      return;
    }
    if (request.url?.startsWith('/index.html')) {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(await readFile(resolve(root, 'dist/app/index.html')));
      return;
    }
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    const threadId =
      request.url?.match(/threads\/(branch-[ab])/)?.[1] ?? 'branch-a';
    response.write(
      `event: thread.snapshot\ndata: ${JSON.stringify({ version: 1, threadId, runs: [], cards: [] })}\n\n`,
    );
  });
  await new Promise<void>((resolve) =>
    activityServer.listen(0, '127.0.0.1', resolve),
  );
  const address = activityServer.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing fixture address');
  origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  activityServer.closeAllConnections();
  await new Promise<void>((resolve) => activityServer.close(() => resolve()));
});

for (const dark of [false, true]) {
  test(`restores drafts without extra host configuration and isolates organizations and branches (${dark ? 'dark' : 'light'})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    let sends = 0;
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/host' || url.pathname === '/index.html')
        return route.continue();
      if (url.pathname === '/web-component.js')
        return route.fulfill({
          contentType: 'application/javascript',
          body: await readFile(
            resolve(root, '../web-component/dist/xpert-chatkit.js'),
          ),
        });
      if (/\/threads\/branch-[ab]\/stream$/.test(url.pathname))
        return route.continue();
      if (url.pathname.startsWith('/api/')) {
        if (url.pathname.endsWith('/runs/stream')) {
          sends++;
          return route.fulfill({
            status: 400,
            json: { message: 'Rejected for fixture' },
          });
        }
        const controlBranch = url.pathname.match(
          /\/threads\/(branch-[ab])\/control-view$/,
        )?.[1];
        if (controlBranch)
          return route.fulfill({
            json: {
              version: 1,
              threadId: controlBranch,
              runId: null,
              revision: '1',
              state: 'idle',
              actions: {
                canSend: true,
                canQueue: false,
                canPause: false,
                canResume: false,
                canTerminate: false,
                canRetry: false,
                canRespond: false,
              },
            },
          });
        if (url.pathname.endsWith('/threads'))
          return route.fulfill({ json: [] });
        const branch = url.pathname.match(/\/threads\/(branch-[ab])$/)?.[1];
        if (branch)
          return route.fulfill({
            json: {
              thread_id: branch,
              status: 'idle',
              metadata: { id: 'conversation' },
              conversation: {
                id: 'conversation',
                threadId: branch,
                xpertId: 'assistant',
                status: 'idle',
                projectId: null,
              },
            },
          });
        if (url.pathname.endsWith('/assistants/assistant'))
          return route.fulfill({
            json: { assistant_id: 'assistant', name: 'Draft test', config: {} },
          });
        if (url.pathname.endsWith('/conversations/conversation'))
          return route.fulfill({
            json: {
              id: 'conversation',
              threadId: 'branch-a',
              xpertId: 'assistant',
              status: 'idle',
              projectId: null,
            },
          });
        if (url.pathname.endsWith('/runs') || url.pathname.endsWith('/views'))
          return route.fulfill({ json: [] });
        if (url.pathname.endsWith('/models'))
          return route.fulfill({ json: { models: [], selectedModelId: null } });
        return route.fulfill({
          json: { items: [], total: 0, data: [], skills: [], plugins: [] },
        });
      }
      const file = resolve(
        root,
        'dist/app',
        `.${decodeURIComponent(url.pathname)}`,
      );
      if (!file.startsWith(resolve(root, 'dist/app') + sep))
        return route.abort();
      try {
        const mime: Record<string, string> = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.woff2': 'font/woff2',
          '.svg': 'image/svg+xml',
        };
        return route.fulfill({
          contentType: mime[extname(file)] ?? 'application/octet-stream',
          body: await readFile(file),
        });
      } catch {
        return route.fulfill({ status: 404, body: 'Missing fixture asset' });
      }
    });
    const surface = page.frameLocator('xpertai-chatkit iframe');
    const input = surface.getByRole('textbox');
    const url = `${origin}/host?${dark ? 'dark=1&' : ''}`;
    const text = 'Draft protection\n\n  第二行 with spaces\nLast line';
    await page.goto(url);
    await expect(input).toBeEditable();
    await input.fill(text);
    await page.reload();
    await expect.poll(() => input.textContent()).toBe(text);
    await expect(input).toBeEditable();
    expect(sends).toBe(0);
    await page.goto(url + 'thread=branch-b');
    await expect(input).toBeEmpty();
    await input.fill('Branch B');
    await page.goto(url + 'org=other');
    await expect(input).toBeEmpty();
    await input.fill('Other organization draft');
    await page.goto(url);
    await expect.poll(() => input.textContent()).toBe(text);
    await surface
      .locator('[data-slot="composer-send-button"][type="submit"]')
      .click();
    await expect.poll(() => sends).toBe(1);
    await expect.poll(() => input.textContent()).toBe(text);
    await page.reload();
    await expect.poll(() => input.textContent()).toBe(text);
    await input.fill('');
    await page.reload();
    await expect(input).toBeEmpty();
    expect(errors).toEqual([]);
    expect(sends).toBe(1);
  });
}
