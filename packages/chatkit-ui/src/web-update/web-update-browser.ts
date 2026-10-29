import { WebUpdateController, type WebRelease } from './web-update-state';

/** Only Xpert's stamped, top-level hosted page opts in. Embeds and library consumers do not poll. */
export function readStandaloneRelease(
  page: Document | undefined = typeof document === 'undefined'
    ? undefined
    : document,
  isTopLevel = typeof window !== 'undefined' && window.parent === window,
): WebRelease | null {
  if (!isTopLevel || !page) return null;
  const buildId = page.querySelector<HTMLMetaElement>(
    'meta[name="xpert-web-build"]',
  )?.content;
  const version = page.querySelector<HTMLMetaElement>(
    'meta[name="xpert-web-version"]',
  )?.content;
  return buildId && version ? { buildId, version } : null;
}

export function createStandaloneWebUpdate(release: WebRelease) {
  // This is a same-origin static deployment manifest, not an authenticated Xpert API.
  return new WebUpdateController(
    release,
    async (signal) => {
      const response = await fetch('/version.json', {
        cache: 'no-store',
        signal,
        headers: { 'ngsw-bypass': 'true' },
      });
      if (!response.ok) throw new Error('Version check failed');
      return response.json();
    },
    {
      getItem: (key) => window.sessionStorage.getItem(key),
      setItem: (key, value) => window.sessionStorage.setItem(key, value),
      removeItem: (key) => window.sessionStorage.removeItem(key),
    },
  );
}

export function watchWebUpdate(controller: WebUpdateController) {
  const visible = () => {
    if (document.visibilityState === 'visible') void controller.check();
  };
  const resourceError = (event: Event) => {
    if (
      event.target instanceof HTMLScriptElement ||
      event.target instanceof HTMLLinkElement
    )
      void controller.check();
  };
  const preloadError = () => {
    void controller.check();
  };
  const interval = setInterval(visible, 60000);
  document.addEventListener('visibilitychange', visible);
  window.addEventListener('online', visible);
  window.addEventListener('pageshow', visible);
  window.addEventListener('error', resourceError, true);
  window.addEventListener('vite:preloadError', preloadError);
  const unsubscribe = controller.subscribe(() => {
    if (controller.state.status !== 'current') return;
    const url = new URL(window.location.href);
    if (url.searchParams.has('_xpert_update')) {
      url.searchParams.delete('_xpert_update');
      window.history.replaceState(window.history.state, '', url.href);
    }
  });
  void controller.check();
  void retireLegacyWorker();
  return () => {
    clearInterval(interval);
    unsubscribe();
    document.removeEventListener('visibilitychange', visible);
    window.removeEventListener('online', visible);
    window.removeEventListener('pageshow', visible);
    window.removeEventListener('error', resourceError, true);
    window.removeEventListener('vite:preloadError', preloadError);
  };
}

async function retireLegacyWorker() {
  try {
    if (!navigator.serviceWorker) return;
    for (const registration of await navigator.serviceWorker.getRegistrations()) {
      const worker =
        registration.active ?? registration.waiting ?? registration.installing;
      if (
        worker?.scriptURL ===
          new URL('/ngsw-worker.js', location.origin).href &&
        registration.scope === new URL('/', location.origin).href
      )
        await registration.update();
    }
  } catch {
    /* A legacy registration must not stop the hosted page from starting. */
  }
}

export function reloadWebUpdate(
  controller: WebUpdateController,
  location: Pick<Location, 'href' | 'replace'> = window.location,
) {
  if (!controller.expectUpdate() || !controller.state.latest) return;
  const url = new URL(location.href);
  url.searchParams.set('_xpert_update', controller.state.latest.buildId);
  location.replace(url.href);
}

export async function prepareWebUpdate(
  participants: Iterable<() => Promise<boolean>>,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.all([...participants].map((prepare) => prepare())).then(
        (results) => results.every(Boolean),
      ),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), 15000);
      }),
    ]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
