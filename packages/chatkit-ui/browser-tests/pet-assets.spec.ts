import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('host overlays load offline and remote assets and update independently', async ({
  page,
}) => {
  const requests: string[] = [];
  const sprite = await readFile(
    resolve(root, '../chatkit-assets/pets/boba/spritesheet.webp'),
  );
  const component = await readFile(
    resolve(root, '../web-component/dist/xpert-chatkit.js'),
  );
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('.webp')) {
      requests.push(url.href);
      return route.fulfill({ contentType: 'image/webp', body: sprite });
    }
    if (url.pathname === '/component.js')
      return route.fulfill({
        contentType: 'application/javascript',
        body: component,
      });
    if (url.pathname === '/frame')
      return route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Offline frame</title>',
      });
    if (url.pathname === '/')
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><body><script type="module">
      import '/component.js';
      const api = { apiUrl: 'https://api.example.test', xpertId: 'assistant' };
      for (const [id, assetsBaseUrl] of [['offline', '/offline/pets'], ['remote', 'https://cdn.example.test/pets/v1'], ['required', '/required/pets']]) {
        const element = document.createElement('xpertai-chatkit');
        element.id = id;
        element.setOptions({ frameUrl: 'http://localhost/frame', api, displayMode: id === 'required' ? 'pet' : 'chat', pet: { assetsBaseUrl, enabled: id !== 'required' } });
        document.body.append(element);
      }
      window.updatePet = (assetsBaseUrl) => document.querySelector('#remote').setOptions({ frameUrl: 'http://localhost/frame', api, pet: { assetsBaseUrl } });
    </script></body>`,
      });
    return route.abort();
  });
  await page.goto('http://localhost');
  await expect
    .poll(() => requests)
    .toContain('http://localhost/offline/pets/boba/spritesheet.webp');
  await expect
    .poll(() => requests)
    .toContain('https://cdn.example.test/pets/v1/boba/spritesheet.webp');
  await page.evaluate(() => {
    const host = window as unknown as { updatePet: (base: string) => void };
    host.updatePet('https://cdn.example.test/pets/v2/');
  });
  await expect
    .poll(() => requests)
    .toContain('https://cdn.example.test/pets/v2/boba/spritesheet.webp');
  expect(
    requests.some(
      (url) => url === 'http://localhost/pets/boba/spritesheet.webp',
    ),
  ).toBe(false);
  await expect
    .poll(() => requests)
    .toContain('http://localhost/required/pets/boba/spritesheet.webp');
  await expect(page.locator('[data-pet-frame]')).toHaveCount(3);
  const backgrounds = await page
    .locator('[data-pet-frame]')
    .evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).backgroundImage),
    );
  expect(backgrounds).toEqual(
    expect.arrayContaining([
      'url("http://localhost/offline/pets/boba/spritesheet.webp")',
      'url("https://cdn.example.test/pets/v2/boba/spritesheet.webp")',
    ]),
  );
});
