import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const appDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../dist/app',
);
const contentTypes: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

for (const { origin, secure, embedded } of [
  { origin: 'http://192.0.2.120', secure: false, embedded: false },
  { origin: 'http://192.0.2.120', secure: false, embedded: true },
  { origin: 'http://localhost', secure: true, embedded: false },
  { origin: 'https://chatkit.test', secure: true, embedded: false },
]) {
  test(`initializes on ${origin}${embedded ? ' inside an iframe' : ''}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    // Serve the production build without a backend or external network. Chromium
    // still applies the real origin's secure-context rules; crypto is not mocked.
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/embed') {
        return route.fulfill({
          contentType: 'text/html',
          body: '<iframe id="chatkit" src="/index.html" sandbox="allow-scripts allow-same-origin" style="width:100%;height:700px"></iframe>',
        });
      }
      const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
      const file = resolve(appDirectory, `.${decodeURIComponent(pathname)}`);
      if (!file.startsWith(`${appDirectory}${sep}`)) return route.abort();
      try {
        const body = await readFile(file);
        return route.fulfill({
          contentType:
            contentTypes[extname(file)] ?? 'application/octet-stream',
          body,
        });
      } catch {
        return route.fulfill({ status: 404, body: 'No diagnostic backend' });
      }
    });

    const response = await page.goto(`${origin}/${embedded ? 'embed' : ''}`);
    expect(response?.status()).toBe(200);
    const surface = embedded ? page.frameLocator('#chatkit') : page;
    await expect(surface.locator('#root > *').first()).toBeVisible();
    await expect(
      surface.getByText('What can I help with today?', { exact: true }),
    ).toBeVisible();
    const capabilities = await surface.locator('#root').evaluate(() => ({
      secure: window.isSecureContext,
      randomUUID: typeof crypto.randomUUID,
      getRandomValues: typeof crypto.getRandomValues,
    }));
    expect(capabilities).toEqual({
      secure,
      randomUUID: secure ? 'function' : 'undefined',
      getRandomValues: 'function',
    });
    expect(errors).toEqual([]);
  });
}
