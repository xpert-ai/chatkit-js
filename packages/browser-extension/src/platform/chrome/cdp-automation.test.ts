import { afterEach, describe, expect, it, vi } from 'vitest';

import { runCdpHostAutomation, type ChromeDebuggerApi } from './cdp-automation';

function createDebuggerApi(
  sendCommand: ChromeDebuggerApi['sendCommand'],
): ChromeDebuggerApi {
  return {
    attach: vi.fn(async () => undefined),
    detach: vi.fn(async () => undefined),
    sendCommand,
  };
}

function parseContent(response: { content?: unknown }) {
  return typeof response.content === 'string'
    ? JSON.parse(response.content)
    : response.content;
}

function createDomRect(
  x: number,
  y: number,
  width: number,
  height: number,
): DOMRect {
  return {
    x,
    y,
    width,
    height,
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({ x, y, width, height }),
  } as DOMRect;
}

function mockRect(element: Element, rect: DOMRect) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => rect,
  });
}

function installSameOriginFrameFixture() {
  document.body.innerHTML = '<iframe id="sap-frame"></iframe>';
  const frame = document.querySelector('iframe');
  if (!frame?.contentDocument) {
    throw new Error('jsdom iframe fixture is unavailable.');
  }

  const frameDocument = frame.contentDocument;
  frameDocument.body.innerHTML = '<button id="execute">执行</button>';
  const button = frameDocument.querySelector('button');
  if (!button) {
    throw new Error('button fixture is unavailable.');
  }

  mockRect(frame, createDomRect(100, 200, 500, 400));
  mockRect(button, createDomRect(300, 350, 80, 30));

  document.elementsFromPoint = vi.fn((x, y) =>
    x >= 100 && x <= 600 && y >= 200 && y <= 600
      ? [frame, document.body]
      : [document.body],
  );
  frameDocument.elementsFromPoint = vi.fn((x, y) =>
    x >= 300 && x <= 380 && y >= 350 && y <= 380
      ? [button, frameDocument.body]
      : [frameDocument.body],
  );

  return { frame, frameDocument, button };
}

function installLaunchpadTileFixture() {
  document.body.innerHTML = [
    '<div id="results" role="region" tabindex="0">',
    '  <div id="tile" role="button" tabindex="0" aria-label="我的采购订单 到期交货" style="cursor: pointer;">',
    '    <span>我的采购订单</span>',
    '    <span>到期交货</span>',
    '  </div>',
    '</div>',
  ].join('');
  const results = document.querySelector('#results');
  const tile = document.querySelector('#tile');
  if (!results || !tile) {
    throw new Error('launchpad tile fixture is unavailable.');
  }

  mockRect(results, createDomRect(20, 120, 1100, 700));
  mockRect(tile, createDomRect(22, 164, 126, 126));

  document.elementsFromPoint = vi.fn((x, y) => {
    if (x >= 22 && x <= 148 && y >= 164 && y <= 290) {
      return [tile, results, document.body];
    }
    if (x >= 20 && x <= 1120 && y >= 120 && y <= 820) {
      return [results, document.body];
    }
    return [document.body];
  });

  return { results, tile };
}

function createRuntimeEvalDebuggerApi(): ChromeDebuggerApi {
  return createDebuggerApi(
    vi.fn(async (_target, method, commandParams) => {
      if (method === 'Runtime.evaluate') {
        const expression =
          commandParams && typeof commandParams.expression === 'string'
            ? commandParams.expression
            : '';
        return {
          result: {
            value: await eval(expression),
          },
        };
      }
      return {};
    }),
  );
}

describe('CDP host automation', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('captures rich snapshots through Runtime, Accessibility, and DOMSnapshot', async () => {
    const sendCommand = vi.fn(async (_target, method) => {
      if (method === 'Runtime.evaluate') {
        return {
          result: {
            value: {
              url: 'https://example.com',
              title: 'Example',
              elements: [],
            },
          },
        };
      }
      if (method === 'Accessibility.getFullAXTree') {
        return {
          nodes: [
            {
              nodeId: 'ax-1',
              role: { value: 'button' },
              name: { value: 'Save' },
              backendDOMNodeId: 12,
            },
          ],
        };
      }
      if (method === 'DOMSnapshot.captureSnapshot') {
        return { documents: [{}], strings: ['button'] };
      }
      return {};
    });
    const debuggerApi = createDebuggerApi(sendCommand);

    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 42, url: 'https://example.com' },
      { name: 'host_page_snapshot', params: {}, id: 'call-1' },
    );
    const content = parseContent(response);

    expect(response.status).toBe('success');
    expect(content).toMatchObject({
      ok: true,
      result: {
        url: 'https://example.com',
        accessibility: [
          {
            axRef: 'ax-1',
            role: 'button',
            name: 'Save',
            backendDOMNodeId: 12,
          },
        ],
        cdp: {
          domSnapshot: {
            documents: 1,
            strings: 1,
          },
        },
      },
    });
    expect(debuggerApi.attach).toHaveBeenCalledWith({ tabId: 42 }, '1.3');
    expect(debuggerApi.detach).toHaveBeenCalledWith({ tabId: 42 });
    expect(sendCommand).toHaveBeenCalledWith(
      { tabId: 42 },
      'Accessibility.getFullAXTree',
      undefined,
    );
    expect(sendCommand).toHaveBeenCalledWith(
      { tabId: 42 },
      'DOMSnapshot.captureSnapshot',
      expect.any(Object),
    );
  });

  it('uses CDP mouse events for clicks', async () => {
    const sendCommand = vi.fn(async (_target, method) => {
      if (method === 'Runtime.evaluate') {
        return {
          result: {
            value: {
              point: { x: 120, y: 40 },
              target: { tag: 'button', name: 'Save' },
            },
          },
        };
      }
      return {};
    });
    const debuggerApi = createDebuggerApi(sendCommand);

    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 42, url: 'https://example.com' },
      { name: 'host_page_click', params: { role: 'button', name: 'Save' } },
    );

    expect(response.status).toBe('success');
    expect(sendCommand).toHaveBeenCalledWith(
      { tabId: 42 },
      'Input.dispatchMouseEvent',
      expect.objectContaining({ type: 'mouseMoved', x: 120, y: 40 }),
    );
    expect(sendCommand).toHaveBeenCalledWith(
      { tabId: 42 },
      'Input.dispatchMouseEvent',
      expect.objectContaining({ type: 'mousePressed', button: 'left' }),
    );
    expect(sendCommand).toHaveBeenCalledWith(
      { tabId: 42 },
      'Input.dispatchMouseEvent',
      expect.objectContaining({ type: 'mouseReleased', button: 'left' }),
    );
  });

  it('resolves accessibility refs through backend DOM nodes', async () => {
    const sendCommand = vi.fn(async (_target, method, commandParams) => {
      if (method === 'Accessibility.getFullAXTree') {
        return {
          nodes: [
            {
              nodeId: '255198',
              backendDOMNodeId: 12,
              role: { value: 'button' },
              name: { value: '执行' },
            },
          ],
        };
      }
      if (method === 'DOM.resolveNode') {
        expect(commandParams).toEqual({ backendNodeId: 12 });
        return { object: { objectId: 'object-12' } };
      }
      if (method === 'Runtime.callFunctionOn') {
        expect(commandParams).toMatchObject({
          objectId: 'object-12',
          returnByValue: true,
          userGesture: true,
        });
        return {
          result: {
            value: {
              point: { x: 820, y: 742 },
              target: { tag: 'button', role: 'button', name: '执行' },
              requested: { tag: 'button', role: 'button', name: '执行' },
              targetingStrategy: 'ax_resolved_target',
            },
          },
        };
      }
      return {};
    });
    const debuggerApi = createDebuggerApi(sendCommand);

    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 42, url: 'https://example.com' },
      { name: 'host_page_click', params: { axRef: '255198' } },
    );
    const content = parseContent(response);

    expect(response.status).toBe('success');
    expect(content).toMatchObject({
      ok: true,
      result: {
        clicked: { tag: 'button', role: 'button', name: '执行' },
        point: { x: 820, y: 742 },
      },
    });
    expect(sendCommand).toHaveBeenCalledWith(
      { tabId: 42 },
      'Input.dispatchMouseEvent',
      expect.objectContaining({ type: 'mouseMoved', x: 820, y: 742 }),
    );
    expect(sendCommand).toHaveBeenCalledWith(
      { tabId: 42 },
      'Runtime.releaseObject',
      { objectId: 'object-12' },
    );
  });

  it('uses viewport coordinates for pointer clicks and returns hit-test details', async () => {
    const sendCommand = vi.fn(async (_target, method) => {
      if (method === 'Runtime.evaluate') {
        return {
          result: {
            value: {
              coordinateSpace: 'viewport-css-px',
              hitTarget: { tag: 'button', name: 'Execute' },
              hitStack: [{ tag: 'button', name: 'Execute' }],
            },
          },
        };
      }
      return {};
    });
    const debuggerApi = createDebuggerApi(sendCommand);

    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 42, url: 'https://example.com' },
      {
        name: 'host_page_pointer',
        params: {
          action: 'click',
          x: 320,
          y: 480,
          button: 'right',
          clickCount: 2,
        },
      },
    );
    const content = parseContent(response);

    expect(response.status).toBe('success');
    expect(content).toMatchObject({
      ok: true,
      result: {
        pointer: 'click',
        point: { x: 320, y: 480 },
        button: 'right',
        clickCount: 2,
        coordinateSpace: 'viewport-css-px',
        hitTarget: { tag: 'button', name: 'Execute' },
      },
    });
    expect(sendCommand).toHaveBeenCalledWith(
      { tabId: 42 },
      'Input.dispatchMouseEvent',
      expect.objectContaining({
        type: 'mousePressed',
        x: 320,
        y: 480,
        button: 'right',
        clickCount: 2,
      }),
    );
  });

  it('clicks same-origin iframe elements using top viewport coordinates', async () => {
    installSameOriginFrameFixture();
    const debuggerApi = createRuntimeEvalDebuggerApi();

    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 42, url: 'https://example.com' },
      { name: 'host_page_click', params: { role: 'button', name: '执行' } },
    );

    expect(response.status).toBe('success');
    expect(debuggerApi.sendCommand).toHaveBeenCalledWith(
      { tabId: 42 },
      'Input.dispatchMouseEvent',
      expect.objectContaining({
        type: 'mouseMoved',
        x: 440,
        y: 565,
      }),
    );
  });

  it('prefers a precise clickable tile over a broad matching container', async () => {
    installLaunchpadTileFixture();
    const debuggerApi = createRuntimeEvalDebuggerApi();

    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 42, url: 'https://example.com' },
      {
        name: 'host_page_click',
        params: { name: '我的采购订单到期交货' },
      },
    );
    const content = parseContent(response);

    expect(response.status).toBe('success');
    expect(content).toMatchObject({
      ok: true,
      result: {
        clicked: {
          tag: 'div',
          role: 'button',
          name: '我的采购订单 到期交货',
        },
        point: { x: 85, y: 227 },
      },
    });
    expect(debuggerApi.sendCommand).toHaveBeenCalledWith(
      { tabId: 42 },
      'Input.dispatchMouseEvent',
      expect.objectContaining({
        type: 'mouseMoved',
        x: 85,
        y: 227,
      }),
    );
  });

  it('hit-tests pointer coordinates inside same-origin iframes', async () => {
    installSameOriginFrameFixture();
    const debuggerApi = createRuntimeEvalDebuggerApi();

    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 42, url: 'https://example.com' },
      {
        name: 'host_page_pointer',
        params: {
          action: 'move',
          x: 440,
          y: 565,
        },
      },
    );
    const content = parseContent(response);

    expect(response.status).toBe('success');
    expect(content).toMatchObject({
      ok: true,
      result: {
        pointer: 'move',
        point: { x: 440, y: 565 },
        hitTarget: { tag: 'button', role: 'button', name: '执行' },
      },
    });
  });

  it('returns screenshots through artifacts instead of model-facing base64 content', async () => {
    const screenshotData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
    const sendCommand = vi.fn(async (_target, method) => {
      if (method === 'Page.captureScreenshot') {
        return { data: screenshotData };
      }
      if (method === 'Page.getLayoutMetrics') {
        return {
          visualViewport: {
            clientWidth: 1440,
            clientHeight: 900,
          },
        };
      }
      if (method === 'Runtime.evaluate') {
        return {
          result: {
            value: {
              viewport: { width: 1440, height: 900 },
              devicePixelRatio: 2,
              scroll: { x: 10, y: 20 },
            },
          },
        };
      }
      return {};
    });
    const debuggerApi = createDebuggerApi(sendCommand);

    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 42, url: 'https://example.com' },
      {
        name: 'host_page_screenshot',
        params: { format: 'png' },
        id: 'call-1',
      },
    );
    const content = parseContent(response);

    expect(response.status).toBe('success');
    expect(content).toEqual({
      ok: true,
      result: {
        mimeType: 'image/png',
        dataLength: screenshotData.length,
        viewport: { width: 1440, height: 900 },
        imageSize: { width: 1, height: 1 },
        devicePixelRatio: 2,
        scroll: { x: 10, y: 20 },
        coordinateSpace: 'viewport-css-px',
      },
    });
    expect(response.content).not.toContain(screenshotData);
    expect(response.artifact).toEqual({
      type: 'host_page_screenshot',
      mimeType: 'image/png',
      data: screenshotData,
      viewport: { width: 1440, height: 900 },
      imageSize: { width: 1, height: 1 },
      devicePixelRatio: 2,
      scroll: { x: 10, y: 20 },
      coordinateSpace: 'viewport-css-px',
    });
  });

  it('parses JPEG screenshot dimensions', async () => {
    const screenshotData = '/9j/wAARCAACAAMDAREAAhEAAxEA/9k=';
    const sendCommand = vi.fn(async (_target, method) => {
      if (method === 'Page.captureScreenshot') {
        return { data: screenshotData };
      }
      if (method === 'Page.getLayoutMetrics') {
        return {
          layoutViewport: {
            clientWidth: 1280,
            clientHeight: 720,
          },
        };
      }
      return {};
    });
    const debuggerApi = createDebuggerApi(sendCommand);

    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 42, url: 'https://example.com' },
      {
        name: 'host_page_screenshot',
        params: { format: 'jpeg' },
        id: 'call-1',
      },
    );
    const content = parseContent(response);

    expect(content).toMatchObject({
      ok: true,
      result: {
        mimeType: 'image/jpeg',
        viewport: { width: 1280, height: 720 },
        imageSize: { width: 3, height: 2 },
        coordinateSpace: 'viewport-css-px',
      },
    });
  });
});
