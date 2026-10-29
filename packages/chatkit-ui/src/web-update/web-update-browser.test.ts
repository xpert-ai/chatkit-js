import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebUpdateController } from './web-update-state';
import {
  createStandaloneWebUpdate,
  prepareWebUpdate,
  readStandaloneRelease,
  reloadWebUpdate,
  watchWebUpdate,
} from './web-update-browser';

describe('Standalone web deployment integration', () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.head.innerHTML =
      '<meta name="xpert-web-build" content="A"><meta name="xpert-web-version" content="3">';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('opts in only a stamped top-level page, never embeds or third-party libraries', () => {
    expect(readStandaloneRelease(document, true)).toEqual({
      buildId: 'A',
      version: '3',
    });
    expect(readStandaloneRelease(document, false)).toBeNull();
    document.head.innerHTML = '';
    expect(readStandaloneRelease(document, true)).toBeNull();
  });

  it('fetches the static manifest without HTTP or legacy Angular worker caching', async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ buildId: 'B', version: '3' }),
    }));
    vi.stubGlobal('fetch', fetch);
    const controller = createStandaloneWebUpdate({
      buildId: 'A',
      version: '3',
    });
    await controller.check();
    expect(fetch).toHaveBeenCalledWith(
      '/version.json',
      expect.objectContaining({
        cache: 'no-store',
        headers: { 'ngsw-bypass': 'true' },
      }),
    );
    expect(controller.state.status).toBe('available');
  });

  it('preserves address and unrelated session data while recording the expected build', async () => {
    const controller = new WebUpdateController(
      { buildId: 'A', version: '3' },
      async () => ({ buildId: 'B', version: '3' }),
      sessionStorage,
    );
    await controller.check();
    sessionStorage.setItem('login', 'untouched');
    const replace = vi.fn();
    reloadWebUpdate(controller, {
      href: 'https://xpert.test/chatkit?threadId=one#options',
      replace,
    });
    expect(replace).toHaveBeenCalledWith(
      'https://xpert.test/chatkit?threadId=one&_xpert_update=B#options',
    );
    expect(sessionStorage.getItem('login')).toBe('untouched');
    expect(sessionStorage.getItem('xpert.web-update.expected')).toBe('B');
  });

  it('checks visible pages every minute and on wake/network/chunk failure, and cleans up', async () => {
    vi.useFakeTimers({
      toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
    });
    const fetchRelease = vi.fn(async () => ({ buildId: 'A', version: '3' }));
    const controller = new WebUpdateController(
      { buildId: 'A', version: '3' },
      fetchRelease,
      sessionStorage,
    );
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const stop = watchWebUpdate(controller);
    await controller.check();
    expect(fetchRelease).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchRelease).toHaveBeenCalledTimes(2);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchRelease).toHaveBeenCalledTimes(2);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    for (const event of ['online', 'pageshow', 'vite:preloadError']) {
      window.dispatchEvent(new Event(event));
      await controller.check();
    }
    expect(fetchRelease).toHaveBeenCalledTimes(5);
    stop();
    await vi.advanceTimersByTimeAsync(60000);
    window.dispatchEvent(new Event('online'));
    expect(fetchRelease).toHaveBeenCalledTimes(5);
  });

  it('does not leave if any save rejects, refuses or stalls', async () => {
    expect(await prepareWebUpdate([async () => false])).toBe(false);
    expect(
      await prepareWebUpdate([
        async () => {
          throw new Error('save');
        },
      ]),
    ).toBe(false);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const pending = prepareWebUpdate([
      () => new Promise<boolean>(() => undefined),
    ]);
    await vi.advanceTimersByTimeAsync(15000);
    expect(await pending).toBe(false);
    expect(await prepareWebUpdate([async () => true])).toBe(true);
  });
});
