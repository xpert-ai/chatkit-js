import { access } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';

import { BrowserRunner, type IsolatedBrowserSession } from './runner.js';

function createSession(): IsolatedBrowserSession & {
  emitManualIntervention: () => void;
  emitClosed: () => void;
} {
  let manualListener = () => undefined;
  let closedListener = () => undefined;
  return {
    execute: vi.fn(async (call) => ({
      tool_call_id: call.tool_call_id ?? call.id,
      name: call.name,
      status: 'success',
      content: JSON.stringify({
        ok: true,
        result:
          call.name === 'host_page_snapshot'
            ? { pageStateId: 'page-1' }
            : { dispatched: true },
      }),
    })),
    close: vi.fn(async () => undefined),
    onManualIntervention(listener) {
      manualListener = listener;
    },
    onClosed(listener) {
      closedListener = listener;
    },
    emitManualIntervention: () => manualListener(),
    emitClosed: () => closedListener(),
  };
}

describe('BrowserRunner', () => {
  it('starts a headed browser with isolated profile and download directories', async () => {
    const session = createSession();
    const launch = vi.fn(async () => session);
    const runner = new BrowserRunner({ launch });

    const status = await runner.start({ startUrl: 'https://example.com' });

    expect(status).toMatchObject({
      state: 'running',
      sessionId: expect.any(String),
    });
    expect(launch).toHaveBeenCalledWith(
      expect.objectContaining({
        headless: false,
        startUrl: 'https://example.com',
        profileDir: expect.stringContaining('profile'),
        downloadsDir: expect.stringContaining('downloads'),
      }),
    );
    const launchOptions = launch.mock.calls[0]?.[0];
    expect(launchOptions?.profileDir).not.toContain('.config/google-chrome');
    await expect(access(launchOptions!.profileDir)).resolves.toBeUndefined();
    await expect(access(launchOptions!.downloadsDir)).resolves.toBeUndefined();

    await runner.stop();
    await expect(access(launchOptions!.profileDir)).rejects.toThrow();
  });

  it('pauses after manual intervention and requires a fresh snapshot', async () => {
    const session = createSession();
    const runner = new BrowserRunner({ launch: vi.fn(async () => session) });
    await runner.start();
    await runner.execute({ name: 'host_page_snapshot', id: 'snapshot-1' });

    session.emitManualIntervention();

    expect(runner.status()).toMatchObject({
      state: 'paused',
      invalidatedPageStateId: 'page-1',
    });
    const rejected = await runner.execute({
      name: 'host_page_click',
      id: 'click-1',
      params: { pageStateId: 'page-1', documentRef: 'd1', ref: 'e1' },
    });
    expect(JSON.parse(String(rejected.content))).toMatchObject({
      ok: false,
      code: 'stale_page_state',
      outcome: 'rejected_before_execution',
      requiresFreshSnapshot: true,
      invalidatedPageStateId: 'page-1',
    });
    await runner.execute({ name: 'host_page_snapshot', id: 'snapshot-2' });
    expect(runner.status().state).toBe('running');

    await runner.stop();
  });

  it('binds the latest snapshot page state when navigation omits it', async () => {
    const session = createSession();
    const runner = new BrowserRunner({ launch: vi.fn(async () => session) });
    await runner.start();
    await runner.execute({ name: 'host_page_snapshot', id: 'snapshot-1' });

    await runner.execute({
      name: 'host_page_navigate',
      id: 'navigate-1',
      params: { url: 'https://xpertai.cn/apps/' },
    });

    expect(session.execute).toHaveBeenLastCalledWith({
      name: 'host_page_navigate',
      id: 'navigate-1',
      params: {
        url: 'https://xpertai.cn/apps/',
        pageStateId: 'page-1',
      },
    });
    await runner.stop();
  });

  it('preserves an explicitly supplied navigation page state', async () => {
    const session = createSession();
    const runner = new BrowserRunner({ launch: vi.fn(async () => session) });
    await runner.start();
    await runner.execute({ name: 'host_page_snapshot', id: 'snapshot-1' });

    await runner.execute({
      name: 'host_page_navigate',
      id: 'navigate-1',
      params: {
        url: 'https://xpertai.cn/apps/',
        pageStateId: 'explicit-page-state',
      },
    });

    expect(session.execute).toHaveBeenLastCalledWith({
      name: 'host_page_navigate',
      id: 'navigate-1',
      params: {
        url: 'https://xpertai.cn/apps/',
        pageStateId: 'explicit-page-state',
      },
    });
    await runner.stop();
  });

  it('releases the session when the isolated window closes', async () => {
    const session = createSession();
    const runner = new BrowserRunner({ launch: vi.fn(async () => session) });
    await runner.start();

    session.emitClosed();
    await vi.waitFor(() => expect(runner.status().state).toBe('stopped'));
  });
});
