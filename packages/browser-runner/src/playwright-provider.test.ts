import { describe, expect, it, vi } from 'vitest';

const { launchPersistentContext } = vi.hoisted(() => ({
  launchPersistentContext: vi.fn(),
}));

vi.mock('playwright-core', () => ({
  chromium: { launchPersistentContext },
}));

import { launchPlaywrightBrowserSession } from './playwright-provider.js';

function createBrowserFixture(
  initialUrl = 'https://example.com/current',
  elementType?: 'password',
) {
  let currentUrl = initialUrl;
  const elementHandle = elementType
    ? {
        evaluate: vi.fn(async (callback: unknown) => {
          const source = String(callback);
          if (source.includes('element.isConnected')) return true;
          if (source.includes('password_input')) return ['password_input'];
          return {
            tag: 'input',
            role: 'textbox',
            name: undefined,
            text: undefined,
            testId: undefined,
          };
        }),
        boundingBox: vi.fn(async () => ({
          x: 10,
          y: 20,
          width: 200,
          height: 32,
        })),
        isVisible: vi.fn(async () => true),
        isEnabled: vi.fn(async () => true),
        fill: vi.fn(async () => undefined),
      }
    : undefined;
  const frame = {
    url: vi.fn(() => currentUrl),
    locator: vi.fn(() => ({
      elementHandles: vi.fn(async () => (elementHandle ? [elementHandle] : [])),
    })),
    evaluate: vi.fn(async () => undefined),
  };
  const page = {
    url: vi.fn(() => currentUrl),
    goto: vi.fn(async (url: string) => {
      currentUrl = url;
    }),
    frames: vi.fn(() => [frame]),
    mainFrame: vi.fn(() => frame),
    on: vi.fn(),
    evaluate: vi.fn(async (callback: unknown) => {
      const source = String(callback);
      if (source.includes('window.scrollX')) return { x: 0, y: 0 };
      if (source.includes('document.readyState')) return 'complete';
      return undefined;
    }),
    locator: vi.fn(() => ({ innerText: vi.fn(async () => '') })),
    viewportSize: vi.fn(() => ({ width: 1280, height: 720 })),
    title: vi.fn(async () => 'Current page'),
    waitForTimeout: vi.fn(async () => undefined),
  };
  const context = {
    exposeBinding: vi.fn(async () => undefined),
    addInitScript: vi.fn(async () => undefined),
    pages: vi.fn(() => [page]),
    on: vi.fn(),
    close: vi.fn(async () => undefined),
  };
  launchPersistentContext.mockResolvedValue(context);
  return { elementHandle, page };
}

function parseContent(content: unknown) {
  if (typeof content !== 'string') {
    throw new Error('Expected JSON tool message content.');
  }
  return JSON.parse(content) as Record<string, unknown>;
}

describe('Playwright browser provider approval policy', () => {
  it('allows cross-origin navigation without approval', async () => {
    const { page } = createBrowserFixture();
    const session = await launchPlaywrightBrowserSession({
      sessionId: 'session-1',
      headless: false,
      profileDir: '/tmp/chatkit-browser-profile',
      downloadsDir: '/tmp/chatkit-browser-downloads',
    });
    const snapshot = parseContent(
      (await session.execute({ name: 'host_page_snapshot', id: 'snapshot-1' }))
        .content,
    );
    const result = snapshot.result as Record<string, unknown>;

    const navigation = await session.execute({
      name: 'host_page_navigate',
      id: 'navigate-1',
      params: {
        pageStateId: result.pageStateId,
        url: 'https://other.example/path',
      },
    });

    expect(parseContent(navigation.content)).toMatchObject({ ok: true });
    expect(navigation).toMatchObject({ status: 'success' });
    expect(page.goto).toHaveBeenCalledWith('https://other.example/path');
    await session.close();
  });

  it('still requires approval before filling a password', async () => {
    const { elementHandle } = createBrowserFixture(
      'https://example.com/login',
      'password',
    );
    const session = await launchPlaywrightBrowserSession({
      sessionId: 'session-2',
      headless: false,
      profileDir: '/tmp/chatkit-browser-profile',
      downloadsDir: '/tmp/chatkit-browser-downloads',
    });
    const snapshot = parseContent(
      (await session.execute({ name: 'host_page_snapshot', id: 'snapshot-2' }))
        .content,
    );
    const result = snapshot.result as Record<string, unknown>;
    const target = (result.elements as Array<Record<string, unknown>>)[0];

    const fill = await session.execute({
      name: 'host_page_fill',
      id: 'fill-password-1',
      params: {
        pageStateId: result.pageStateId,
        documentRef: target?.documentRef,
        ref: target?.ref,
        value: 'secret',
      },
    });

    expect(fill).toMatchObject({ status: 'error' });
    expect(parseContent(fill.content)).toMatchObject({
      code: 'approval_required',
      risks: ['password_input'],
      actionToken: expect.any(String),
    });
    expect(elementHandle?.fill).not.toHaveBeenCalled();
    await session.close();
  });
});
