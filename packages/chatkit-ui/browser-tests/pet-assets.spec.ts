import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function servePetHost(page: Page) {
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
        const options = { frameUrl: 'http://localhost/frame', api, displayMode: id === 'required' ? 'pet' : 'chat', pet: { assetsBaseUrl, enabled: id !== 'required' } };
        if (id === 'required') {
          const render = () => element.setOptions({ ...options, pet: { ...options.pet, launcherVisible: localStorage.getItem('fixture:pet:hidden') !== '1' } });
          element.addEventListener('chatkit.pet.launcher.visibility.change', ({ detail }) => {
            if (detail.visible) localStorage.removeItem('fixture:pet:hidden');
            else localStorage.setItem('fixture:pet:hidden', '1');
            render();
          });
          render();
        } else {
          element.setOptions(options);
        }
        document.body.append(element);
      }
      window.updatePet = (assetsBaseUrl) => document.querySelector('#remote').setOptions({ frameUrl: 'http://localhost/frame', api, pet: { assetsBaseUrl } });
    </script></body>`,
      });
    return route.abort();
  });
  return requests;
}

test('host overlays load offline and remote assets and update independently', async ({
  page,
}) => {
  const requests = await servePetHost(page);
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

test('a host can remember launcher visibility across page reloads', async ({
  page,
}) => {
  await servePetHost(page);
  await page.goto('http://localhost');
  const launcher = page.locator('#required');
  const pet = launcher.locator('[data-chatkit-host-pet]');
  const reopen = launcher.getByRole('button', { name: 'Show pet' });
  await pet.click({ button: 'right' });
  await launcher.getByRole('menuitem', { name: 'Close pet' }).click();
  await expect(reopen).toBeVisible();
  await page.reload();
  await expect(reopen).toBeVisible();
  await expect(pet).toHaveCount(0);
  await expect(page.locator('#offline [data-chatkit-host-pet]')).toBeVisible();
  await reopen.click();
  await expect(pet).toBeVisible();
  await page.reload();
  await expect(pet).toBeVisible();
  await expect(reopen).toHaveCount(0);
});
