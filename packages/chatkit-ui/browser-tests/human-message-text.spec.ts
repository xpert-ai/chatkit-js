import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let server: ViteDevServer;
let cache: string;
let origin: string;

test.use({ locale: 'zh-CN' });

test.beforeAll(async () => {
  cache = await mkdtemp(resolve(tmpdir(), 'chatkit-human-text-'));
  server = await createServer({
    root,
    cacheDir: cache,
    server: { host: '127.0.0.1', port: 0, open: false },
  });
  await server.listen();
  origin = server.resolvedUrls!.local[0];
});

test.afterAll(async () => {
  await server?.close();
  if (cache) await rm(cache, { recursive: true, force: true });
});

for (const theme of ['', '?dark&bubbles']) {
  test(`folds human text and preserves full content, keyboard controls and themes (${theme || 'light'})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1000, height: 900 });
    await page.goto(`${origin}dev/human-message-text/${theme}`);
    const short = page
      .locator('[data-human-bubble]')
      .filter({ hasText: '简短的用户消息' });
    const long = page
      .locator('[data-human-bubble]')
      .filter({ hasText: '完整消息末尾' });
    const toggle = long.getByRole('button', { name: '展示更多', exact: true });
    const preview = long.locator('[data-human-text-preview]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(short.getByRole('button')).toHaveCount(0);
    const collapsed = await preview.boundingBox();
    expect(collapsed!.height).toBeLessThan(350);
    expect(await preview.evaluate((node) => node.scrollHeight)).toBeGreaterThan(
      collapsed!.height * 2,
    );
    const original = await preview.textContent();

    await toggle.focus();
    await page.keyboard.press('Enter');
    const collapse = long.getByRole('button', { name: '收起', exact: true });
    await expect(collapse).toHaveAttribute('aria-expanded', 'true');
    await expect
      .poll(async () => (await preview.boundingBox())!.height)
      .toBeGreaterThan(collapsed!.height * 2);
    expect(await preview.textContent()).toBe(original);
    await expect(collapse).toBeFocused();
    const colors = await collapse.evaluate((button) => ({
      text: getComputedStyle(button).color,
      bubble: getComputedStyle(button.closest('[data-human-bubble]')!).color,
    }));
    expect(colors.text).toBe(colors.bubble);

    await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect
      .poll(async () => (await preview.boundingBox())!.height)
      .toBeCloseTo(collapsed!.height, 0);
    expect(await preview.textContent()).toBe(original);
    await expect(page.locator('[data-human-text-preview]')).toHaveCount(4);
    await page.screenshot({ path: test.info().outputPath('collapsed.png') });
  });
}

test('rechecks wrapping, multi-part text and message edits', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto(`${origin}dev/human-message-text/`);
  const wrapped = page.locator('[data-human-bubble]').nth(2);
  await expect(wrapped).toBeVisible();
  await expect(wrapped.getByRole('button')).toHaveCount(0);
  await page.setViewportSize({ width: 360, height: 900 });
  await expect(wrapped.getByRole('button', { name: '展示更多' })).toBeVisible();
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect(wrapped.getByRole('button')).toHaveCount(0);
  const parts = page.locator('[data-human-bubble]').nth(3);
  await expect(parts.getByRole('button', { name: '展示更多' })).toBeVisible();
  await parts.getByRole('button', { name: '展示更多' }).click();
  await expect(parts).toContainText('第 20 段消息');

  await page.getByRole('button', { name: '替换长消息' }).click();
  const updated = page.locator('[data-human-bubble]').nth(1);
  await expect(updated).toHaveText('更新后的短消息');
  await expect(updated.getByRole('button')).toHaveCount(0);
  await page.getByRole('button', { name: '替换长消息' }).click();
  await expect(updated.getByRole('button', { name: '展示更多' })).toBeVisible();
});
