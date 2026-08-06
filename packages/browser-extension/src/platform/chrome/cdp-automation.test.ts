import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearCdpAutomationStateForTab,
  resetCdpAutomationStateForTesting,
  runCdpHostAutomation,
  type ChromeDebuggerApi,
} from './cdp-automation';

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

function mockVisibleTree(root: ParentNode = document.body) {
  Array.from(root.querySelectorAll('*')).forEach((element, index) => {
    mockRect(element, createDomRect(10, 10 + index * 24, 320, 20));
  });
}

function findVisualEffectEvaluationIndex(
  sendCommand: ReturnType<typeof vi.fn>,
): number {
  return sendCommand.mock.calls.findIndex(([, method, commandParams]) => {
    if (method !== 'Runtime.evaluate') {
      return false;
    }
    const expression =
      commandParams &&
      typeof commandParams === 'object' &&
      'expression' in commandParams
        ? commandParams.expression
        : undefined;
    return (
      typeof expression === 'string' &&
      expression.includes('data-xpertai-chatkit-visual-effect')
    );
  });
}

function findFirstMouseEventIndex(sendCommand: ReturnType<typeof vi.fn>) {
  return sendCommand.mock.calls.findIndex(
    ([, method]) => method === 'Input.dispatchMouseEvent',
  );
}

function findFirstKeyEventIndex(sendCommand: ReturnType<typeof vi.fn>) {
  return sendCommand.mock.calls.findIndex(
    ([, method]) => method === 'Input.dispatchKeyEvent',
  );
}

function findFirstScreenshotIndex(sendCommand: ReturnType<typeof vi.fn>) {
  return sendCommand.mock.calls.findIndex(
    ([, method]) => method === 'Page.captureScreenshot',
  );
}

function findRuntimeEvaluationIndexContaining(
  sendCommand: ReturnType<typeof vi.fn>,
  text: string,
) {
  return sendCommand.mock.calls.findIndex(([, method, commandParams]) => {
    if (method !== 'Runtime.evaluate') {
      return false;
    }
    const expression =
      commandParams &&
      typeof commandParams === 'object' &&
      'expression' in commandParams
        ? commandParams.expression
        : undefined;
    return typeof expression === 'string' && expression.includes(text);
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
    vi.useRealTimers();
    document.body.innerHTML = '';
    Reflect.deleteProperty(globalThis, '__xpertaiChatKitHostAutomation');
    resetCdpAutomationStateForTesting();
    vi.restoreAllMocks();
  });

  it('binds CDP snapshot refs to a cached v2 page state and document scope', async () => {
    document.body.innerHTML = `
      <button id="save" data-testid="save">Save</button>
      <button>Unstable</button>
    `;
    mockVisibleTree();
    document.elementsFromPoint = vi.fn(() => [
      document.querySelector('#save')!,
      document.body,
    ]);
    const debuggerApi = createRuntimeEvalDebuggerApi();
    const sendCommand = vi.mocked(debuggerApi.sendCommand);

    const firstResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 420, url: 'https://example.com' },
      { name: 'host_page_snapshot', params: {}, id: 'call-v2-snapshot-1' },
    );
    const first = parseContent(firstResponse).result as Record<string, unknown>;
    const pageStateId = first.pageStateId as string;
    const elements = first.elements as Array<Record<string, unknown>>;

    expect(firstResponse.status).toBe('success');
    expect(pageStateId).toEqual(expect.any(String));
    expect(first.capabilities).toMatchObject({
      targetingVersion: 2,
      strictRefs: true,
      strictCoordinates: true,
      freshState: true,
      postconditions: true,
      policyGate: true,
      actionTrace: true,
    });
    expect(first.documents).toEqual([
      expect.objectContaining({ documentRef: 'd1', sameOrigin: true }),
    ]);
    expect(elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ref: expect.any(String),
          documentRef: 'd1',
          selector: '#save',
        }),
        expect.objectContaining({
          name: 'Unstable',
          documentRef: 'd1',
        }),
      ]),
    );
    expect(
      elements.find((element) => element.name === 'Unstable'),
    ).not.toHaveProperty('selector');
    const initialDomSnapshotCalls = sendCommand.mock.calls.filter(
      ([, method]) => method === 'DOMSnapshot.captureSnapshot',
    ).length;

    const cachedResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 420, url: 'https://example.com' },
      {
        name: 'host_page_snapshot',
        params: { pageStateId },
        id: 'call-v2-snapshot-2',
      },
    );
    const cached = parseContent(cachedResponse).result as Record<
      string,
      unknown
    >;

    expect(cached.pageStateId).toBe(pageStateId);
    expect(cached.elements).toEqual(first.elements);
    expect(
      sendCommand.mock.calls.filter(
        ([, method]) => method === 'DOMSnapshot.captureSnapshot',
      ),
    ).toHaveLength(initialDomSnapshotCalls);
  });

  it('expires cached CDP snapshot state after two minutes', async () => {
    const now = new Date('2026-08-05T00:00:00.000Z').getTime();
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now);
    document.body.innerHTML = '<button id="save">Save</button>';
    mockVisibleTree();
    document.elementsFromPoint = vi.fn(() => [
      document.querySelector('#save')!,
      document.body,
    ]);
    const debuggerApi = createRuntimeEvalDebuggerApi();

    const snapshotResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 430, url: 'https://example.com' },
      { name: 'host_page_snapshot', params: {}, id: 'call-expiry-1' },
    );
    expect(snapshotResponse.status).toBe('success');
    const snapshot = parseContent(snapshotResponse).result as Record<
      string,
      unknown
    >;

    dateNow.mockReturnValue(now + 2 * 60_000 + 1);

    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 430, url: 'https://example.com' },
      {
        name: 'host_page_snapshot',
        params: { pageStateId: snapshot.pageStateId },
        id: 'call-expiry-2',
      },
    );

    expect(response.status).toBe('error');
    expect(parseContent(response)).toMatchObject({
      code: 'stale_page_state',
      requiresFreshSnapshot: true,
      invalidatedPageStateId: snapshot.pageStateId,
    });

    const element = (snapshot.elements as Array<Record<string, unknown>>)[0];
    const actionResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 430, url: 'https://example.com' },
      {
        name: 'host_page_click',
        params: {
          pageStateId: snapshot.pageStateId,
          documentRef: element?.documentRef,
          ref: element?.ref,
        },
        id: 'call-expiry-3',
      },
    );
    expect(actionResponse.status).toBe('error');
    expect(parseContent(actionResponse)).toMatchObject({
      code: 'stale_page_state',
      dispatched: false,
    });
    expect(debuggerApi.sendCommand).not.toHaveBeenCalledWith(
      { tabId: 430 },
      'Input.dispatchMouseEvent',
      expect.anything(),
    );
  });

  it('retains at most 32 tab snapshot states', async () => {
    const debuggerApi = createDebuggerApi(
      vi.fn(async (target, method) => {
        if (method === 'Runtime.evaluate') {
          return {
            result: {
              value: {
                pageStateId: `state-${target.tabId}`,
                url: `https://example.com/${target.tabId}`,
                elements: [],
              },
            },
          };
        }
        if (method === 'Accessibility.getFullAXTree') return { nodes: [] };
        if (method === 'DOMSnapshot.captureSnapshot') return { documents: [] };
        return {};
      }),
    );

    for (let tabId = 1; tabId <= 33; tabId += 1) {
      const response = await runCdpHostAutomation(
        { debugger: debuggerApi },
        { id: tabId, url: `https://example.com/${tabId}` },
        { name: 'host_page_snapshot', params: {}, id: `call-${tabId}` },
      );
      expect(response.status).toBe('success');
    }

    const evicted = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 1, url: 'https://example.com/1' },
      {
        name: 'host_page_snapshot',
        params: { pageStateId: 'state-1' },
        id: 'call-evicted',
      },
    );

    expect(evicted.status).toBe('error');
    expect(parseContent(evicted)).toMatchObject({
      code: 'stale_page_state',
      invalidatedPageStateId: 'state-1',
    });
  });

  it('clears cached CDP state when its tab closes', async () => {
    const debuggerApi = createDebuggerApi(
      vi.fn(async (_target, method) => {
        if (method === 'Runtime.evaluate') {
          return {
            result: {
              value: {
                pageStateId: 'closed-tab-state',
                url: 'https://example.com',
                elements: [],
              },
            },
          };
        }
        if (method === 'Accessibility.getFullAXTree') return { nodes: [] };
        if (method === 'DOMSnapshot.captureSnapshot') return { documents: [] };
        return {};
      }),
    );

    await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 431, url: 'https://example.com' },
      { name: 'host_page_snapshot', params: {}, id: 'call-closed-1' },
    );
    clearCdpAutomationStateForTab(431);

    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 431, url: 'https://example.com' },
      {
        name: 'host_page_snapshot',
        params: { pageStateId: 'closed-tab-state' },
        id: 'call-closed-2',
      },
    );

    expect(response.status).toBe('error');
    expect(parseContent(response)).toMatchObject({
      code: 'stale_page_state',
      invalidatedPageStateId: 'closed-tab-state',
    });
  });

  it('rejects ambiguous CDP semantic targets before dispatching input', async () => {
    document.body.innerHTML = '<button>Save</button><button>Save</button>';
    mockVisibleTree();
    document.elementsFromPoint = vi.fn(() => [document.body]);
    const debuggerApi = createRuntimeEvalDebuggerApi();

    const snapshotResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 421, url: 'https://example.com' },
      { name: 'host_page_snapshot', params: {}, id: 'call-ambiguous-1' },
    );
    const snapshot = parseContent(snapshotResponse).result as Record<
      string,
      unknown
    >;
    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 421, url: 'https://example.com' },
      {
        name: 'host_page_click',
        params: {
          pageStateId: snapshot.pageStateId,
          documentRef: 'd1',
          role: 'button',
          name: 'Save',
        },
        id: 'call-ambiguous-2',
      },
    );
    const content = parseContent(response);

    expect(response.status).toBe('error');
    expect(content).toMatchObject({
      ok: false,
      code: 'ambiguous_target',
      dispatched: false,
      outcome: 'rejected_before_execution',
      resolution: {
        strategy: 'semantic_exact',
        pageStateId: snapshot.pageStateId,
        candidates: [
          expect.objectContaining({ documentRef: 'd1', role: 'button' }),
          expect.objectContaining({ documentRef: 'd1', role: 'button' }),
        ],
      },
    });
    expect(debuggerApi.sendCommand).not.toHaveBeenCalledWith(
      { tabId: 421 },
      'Input.dispatchMouseEvent',
      expect.anything(),
    );
  });

  it('rejects a strict CDP target nested inside a disabled actionable ancestor', async () => {
    document.body.innerHTML = `
      <button id="save" disabled><span data-testid="save-icon">Save</span></button>
    `;
    const button = document.querySelector('button');
    const icon = document.querySelector('[data-testid="save-icon"]');
    if (!button || !icon) {
      throw new Error('disabled target fixture is unavailable.');
    }
    mockRect(button, createDomRect(20, 40, 120, 32));
    mockRect(icon, createDomRect(28, 48, 20, 16));
    document.elementsFromPoint = vi.fn(() => [icon, button, document.body]);
    const debuggerApi = createRuntimeEvalDebuggerApi();

    const snapshotResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 426, url: 'https://example.com' },
      { name: 'host_page_snapshot', params: {}, id: 'call-disabled-1' },
    );
    const snapshot = parseContent(snapshotResponse).result as Record<
      string,
      unknown
    >;
    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 426, url: 'https://example.com' },
      {
        name: 'host_page_click',
        params: {
          pageStateId: snapshot.pageStateId,
          documentRef: 'd1',
          testId: 'save-icon',
        },
        id: 'call-disabled-2',
      },
    );
    const content = parseContent(response);

    expect(response.status).toBe('error');
    expect(content).toMatchObject({
      code: 'target_disabled',
      dispatched: false,
      outcome: 'rejected_before_execution',
    });
    expect(debuggerApi.sendCommand).not.toHaveBeenCalledWith(
      { tabId: 426 },
      'Input.dispatchMouseEvent',
      expect.anything(),
    );
  });

  it('requires an exact single-use approval token before CDP password fill', async () => {
    document.body.innerHTML = `<input id="password" type="password" />`;
    const field = document.querySelector<HTMLInputElement>('#password');
    if (!field) {
      throw new Error('password field fixture is unavailable.');
    }
    mockRect(field, createDomRect(20, 40, 180, 32));
    document.elementsFromPoint = vi.fn(() => [field, document.body]);
    const debuggerApi = createRuntimeEvalDebuggerApi();

    const snapshotResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 427, url: 'https://example.com/form' },
      { name: 'host_page_snapshot', params: {}, id: 'call-password-1' },
    );
    const snapshot = parseContent(snapshotResponse).result as Record<
      string,
      unknown
    >;
    const target = (snapshot.elements as Array<Record<string, unknown>>).find(
      (element) => element.tag === 'input',
    );
    const params = {
      pageStateId: snapshot.pageStateId,
      documentRef: target?.documentRef,
      ref: target?.ref,
      value: 'correct horse battery staple',
    };
    const approvalResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 427, url: 'https://example.com/form' },
      {
        name: 'host_page_fill',
        params,
        id: 'call-password-2',
      },
    );
    const approval = parseContent(approvalResponse);

    expect(approvalResponse.status).toBe('error');
    expect(approval).toMatchObject({
      code: 'approval_required',
      dispatched: false,
      outcome: 'rejected_before_execution',
      actionToken: expect.any(String),
      risks: ['password_input'],
    });
    expect(field.value).toBe('');

    const mismatchResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 427, url: 'https://example.com/form' },
      {
        name: 'host_page_fill',
        params: {
          ...params,
          value: 'changed secret',
          actionToken: approval.actionToken,
        },
        id: 'call-password-3',
      },
    );
    const mismatch = parseContent(mismatchResponse);

    expect(mismatchResponse.status).toBe('error');
    expect(mismatch).toMatchObject({
      code: 'approval_required',
      approvalReason: 'action_mismatch',
      actionToken: expect.any(String),
    });
    expect(field.value).toBe('');

    const approvedResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 427, url: 'https://example.com/form' },
      {
        name: 'host_page_fill',
        params: {
          ...params,
          value: 'changed secret',
          actionToken: mismatch.actionToken,
        },
        id: 'call-password-4',
      },
    );

    expect(approvedResponse.status).toBe('success');
    expect(field.value).toBe('changed secret');
  });

  it('requires approval before CDP form submit input dispatch', async () => {
    document.body.innerHTML = `
      <form><button id="submit" type="submit">Submit</button></form>
    `;
    const button = document.querySelector('button');
    if (!button) {
      throw new Error('submit button fixture is unavailable.');
    }
    mockRect(button, createDomRect(20, 40, 120, 32));
    document.elementsFromPoint = vi.fn(() => [button, document.body]);
    const debuggerApi = createRuntimeEvalDebuggerApi();

    const snapshotResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 428, url: 'https://example.com/form' },
      { name: 'host_page_snapshot', params: {}, id: 'call-submit-1' },
    );
    const snapshot = parseContent(snapshotResponse).result as Record<
      string,
      unknown
    >;
    const target = (snapshot.elements as Array<Record<string, unknown>>).find(
      (element) => element.tag === 'button',
    );
    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 428, url: 'https://example.com/form' },
      {
        name: 'host_page_click',
        params: {
          pageStateId: snapshot.pageStateId,
          documentRef: target?.documentRef,
          ref: target?.ref,
        },
        id: 'call-submit-2',
      },
    );

    expect(response.status).toBe('error');
    expect(parseContent(response)).toMatchObject({
      code: 'approval_required',
      dispatched: false,
      risks: ['form_submit'],
    });
    expect(debuggerApi.sendCommand).not.toHaveBeenCalledWith(
      { tabId: 428 },
      'Input.dispatchMouseEvent',
      expect.anything(),
    );
  });

  it('allows a CDP cross-origin link click without approval', async () => {
    document.body.innerHTML =
      '<a id="target" href="https://other.example/path">Open</a>';
    const anchor = document.querySelector('a');
    if (!anchor) {
      throw new Error('cross-origin link fixture is unavailable.');
    }
    mockRect(anchor, createDomRect(20, 40, 120, 32));
    document.elementsFromPoint = vi.fn(() => [anchor, document.body]);
    const debuggerApi = createRuntimeEvalDebuggerApi();

    const snapshotResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 430, url: 'https://example.com/current' },
      { name: 'host_page_snapshot', params: {}, id: 'call-link-1' },
    );
    const snapshot = parseContent(snapshotResponse).result as Record<
      string,
      unknown
    >;
    const target = (snapshot.elements as Array<Record<string, unknown>>).find(
      (element) => element.tag === 'a',
    );
    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 430, url: 'https://example.com/current' },
      {
        name: 'host_page_click',
        params: {
          pageStateId: snapshot.pageStateId,
          documentRef: target?.documentRef,
          ref: target?.ref,
        },
        id: 'call-link-2',
      },
    );

    expect(response.status).toBe('success');
    expect(parseContent(response)).toMatchObject({
      result: { dispatched: true },
    });
    expect(debuggerApi.sendCommand).toHaveBeenCalledWith(
      { tabId: 430 },
      'Input.dispatchMouseEvent',
      expect.objectContaining({ type: 'mousePressed' }),
    );
  });

  it('allows CDP cross-origin navigation without approval', async () => {
    document.body.innerHTML = '<main>Current page</main>';
    mockVisibleTree();
    const debuggerApi = createRuntimeEvalDebuggerApi();

    const snapshotResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 429, url: 'https://example.com/current' },
      { name: 'host_page_snapshot', params: {}, id: 'call-navigate-1' },
    );
    const snapshot = parseContent(snapshotResponse).result as Record<
      string,
      unknown
    >;
    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 429, url: 'https://example.com/current' },
      {
        name: 'host_page_navigate',
        params: {
          pageStateId: snapshot.pageStateId,
          documentRef: 'd1',
          url: 'https://other.example/path',
        },
        id: 'call-navigate-2',
      },
    );

    expect(response.status).toBe('success');
    expect(parseContent(response)).toMatchObject({
      result: {
        dispatched: true,
        navigated: 'https://other.example/path',
      },
    });
    expect(debuggerApi.sendCommand).toHaveBeenCalledWith(
      { tabId: 429 },
      'Page.navigate',
      { url: 'https://other.example/path' },
    );
  });

  it('returns a v2 action outcome and invalidates the dispatched CDP state', async () => {
    document.body.innerHTML =
      '<button id="save" data-testid="save">Save</button>';
    const button = document.querySelector('button');
    if (!button) throw new Error('save button fixture is unavailable.');
    mockRect(button, createDomRect(20, 40, 120, 32));
    document.elementsFromPoint = vi.fn(() => [button, document.body]);
    const debuggerApi = createRuntimeEvalDebuggerApi();

    const snapshotResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 422, url: 'https://example.com' },
      { name: 'host_page_snapshot', params: {}, id: 'call-outcome-1' },
    );
    const snapshot = parseContent(snapshotResponse).result as Record<
      string,
      unknown
    >;
    const target = (snapshot.elements as Array<Record<string, unknown>>).find(
      (element) => element.testId === 'save',
    );
    const params = {
      pageStateId: snapshot.pageStateId,
      documentRef: target?.documentRef,
      ref: target?.ref,
    };
    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 422, url: 'https://example.com' },
      {
        name: 'host_page_click',
        params,
        id: 'call-outcome-2',
      },
    );
    const content = parseContent(response);

    expect(response.status).toBe('success');
    expect(content).toMatchObject({
      ok: true,
      result: {
        dispatched: true,
        outcome: 'executed_unverified',
        requiresFreshSnapshot: true,
        invalidatedPageStateId: snapshot.pageStateId,
        resolution: {
          strategy: 'ref',
          pageStateId: snapshot.pageStateId,
          resolved: expect.objectContaining({
            ref: target?.ref,
            documentRef: 'd1',
            role: 'button',
          }),
        },
        evidence: {
          timestamp: expect.any(String),
          pageStateId: snapshot.pageStateId,
          url: 'https://example.com/',
          action: 'host_page_click',
          outcome: 'executed_unverified',
          requested: expect.objectContaining({
            kind: 'ref',
            ref: target?.ref,
          }),
          resolution: expect.objectContaining({
            strategy: 'ref',
            pageStateId: snapshot.pageStateId,
          }),
        },
      },
    });

    const mouseEventsBeforeRetry = (
      debuggerApi.sendCommand as ReturnType<typeof vi.fn>
    ).mock.calls.filter(
      ([, method]) => method === 'Input.dispatchMouseEvent',
    ).length;
    const staleResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 422, url: 'https://example.com' },
      {
        name: 'host_page_click',
        params,
        id: 'call-outcome-3',
      },
    );
    const staleContent = parseContent(staleResponse);

    expect(staleResponse.status).toBe('error');
    expect(staleContent).toMatchObject({
      code: 'stale_page_state',
      dispatched: false,
      outcome: 'rejected_before_execution',
    });
    expect(
      (debuggerApi.sendCommand as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([, method]) => method === 'Input.dispatchMouseEvent',
      ),
    ).toHaveLength(mouseEventsBeforeRetry);
  });

  it('verifies a fresh CDP postcondition after dispatch', async () => {
    document.body.innerHTML =
      '<button id="save">Save</button><div data-testid="notice">Saved</div>';
    const button = document.querySelector('button');
    const notice = document.querySelector('[data-testid="notice"]');
    if (!button || !notice) {
      throw new Error('postcondition fixture is unavailable.');
    }
    mockRect(button, createDomRect(20, 40, 120, 32));
    mockRect(notice, createDomRect(20, 90, 200, 24));
    document.elementsFromPoint = vi.fn(() => [button, document.body]);
    const debuggerApi = createRuntimeEvalDebuggerApi();

    const snapshotResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 423, url: 'https://example.com' },
      { name: 'host_page_snapshot', params: {}, id: 'call-verify-1' },
    );
    const snapshot = parseContent(snapshotResponse).result as Record<
      string,
      unknown
    >;
    const target = (snapshot.elements as Array<Record<string, unknown>>).find(
      (element) => element.name === 'Save',
    );
    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 423, url: 'https://example.com' },
      {
        name: 'host_page_click',
        params: {
          pageStateId: snapshot.pageStateId,
          documentRef: 'd1',
          ref: target?.ref,
          expectation: {
            type: 'element_visible',
            target: {
              documentScope: 'same_document',
              documentRef: 'd1',
              kind: 'test_id',
              testId: 'notice',
            },
          },
        },
        id: 'call-verify-2',
      },
    );
    const content = parseContent(response);

    expect(response.status).toBe('success');
    expect(content).toMatchObject({
      ok: true,
      result: {
        dispatched: true,
        outcome: 'verified',
        verification: {
          status: 'passed',
          expectation: { type: 'element_visible' },
          actual: true,
        },
      },
    });
  });

  it('returns a failed CDP postcondition without choosing an ambiguous observation target', async () => {
    document.body.innerHTML = `
      <button id="save">Save</button>
      <input data-testid="status" value="first" />
      <input data-testid="status" value="second" />
    `;
    const button = document.getElementById('save');
    if (!button) {
      throw new Error('ambiguous CDP postcondition fixture is unavailable.');
    }
    mockRect(button, createDomRect(20, 40, 120, 32));
    document.elementsFromPoint = vi.fn(() => [button, document.body]);
    const debuggerApi = createRuntimeEvalDebuggerApi();
    const snapshotResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 424, url: 'https://example.com' },
      { name: 'host_page_snapshot', params: {}, id: 'call-ambiguous-1' },
    );
    const snapshot = parseContent(snapshotResponse).result as Record<
      string,
      unknown
    >;
    const target = (snapshot.elements as Array<Record<string, unknown>>).find(
      (element) => element.name === 'Save',
    );

    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 424, url: 'https://example.com' },
      {
        name: 'host_page_click',
        params: {
          pageStateId: snapshot.pageStateId,
          documentRef: 'd1',
          ref: target?.ref,
          expectation: {
            type: 'field_contains',
            target: {
              documentScope: 'same_document',
              documentRef: 'd1',
              kind: 'test_id',
              testId: 'status',
            },
            value: 'first',
          },
        },
        id: 'call-ambiguous-2',
      },
    );
    const content = parseContent(response);

    expect(response.status).toBe('error');
    expect(content).toMatchObject({
      ok: false,
      result: {
        dispatched: true,
        outcome: 'verification_failed',
        verification: { status: 'failed', actual: null },
      },
    });
  });

  it('returns the last CDP observation after postcondition timeout', async () => {
    document.body.innerHTML = `
      <button id="save">Save</button>
      <input data-testid="status" value="pending" />
    `;
    const button = document.getElementById('save');
    if (!button) {
      throw new Error('timeout CDP postcondition fixture is unavailable.');
    }
    mockRect(button, createDomRect(20, 40, 120, 32));
    document.elementsFromPoint = vi.fn(() => [button, document.body]);
    const debuggerApi = createRuntimeEvalDebuggerApi();
    const snapshotResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 425, url: 'https://example.com' },
      { name: 'host_page_snapshot', params: {}, id: 'call-timeout-1' },
    );
    const snapshot = parseContent(snapshotResponse).result as Record<
      string,
      unknown
    >;
    const target = (snapshot.elements as Array<Record<string, unknown>>).find(
      (element) => element.name === 'Save',
    );

    vi.useFakeTimers();
    try {
      const responsePromise = runCdpHostAutomation(
        { debugger: debuggerApi },
        { id: 425, url: 'https://example.com' },
        {
          name: 'host_page_click',
          params: {
            pageStateId: snapshot.pageStateId,
            documentRef: 'd1',
            ref: target?.ref,
            expectation: {
              type: 'field_contains',
              target: {
                documentScope: 'same_document',
                documentRef: 'd1',
                kind: 'test_id',
                testId: 'status',
              },
              value: 'saved',
            },
          },
          id: 'call-timeout-2',
        },
      );
      let settled = false;
      void responsePromise.then(
        () => {
          settled = true;
        },
        () => {
          settled = true;
        },
      );
      for (let index = 0; index < 250 && !settled; index += 1) {
        await vi.advanceTimersByTimeAsync(100);
      }
      expect(settled).toBe(true);
      const response = await responsePromise;
      const content = parseContent(response);

      expect(response.status).toBe('error');
      expect(content).toMatchObject({
        ok: false,
        result: {
          dispatched: true,
          outcome: 'verification_failed',
          verification: { status: 'timed_out', actual: 'pending' },
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects ambiguous strict coordinate identities before CDP dispatch', async () => {
    document.body.innerHTML = '<button>Open</button><button>Open</button>';
    const buttons = Array.from(document.querySelectorAll('button'));
    mockRect(buttons[0]!, createDomRect(20, 40, 120, 32));
    mockRect(buttons[1]!, createDomRect(20, 90, 120, 32));
    document.elementsFromPoint = vi.fn(() => [buttons[0]!, document.body]);
    const debuggerApi = createRuntimeEvalDebuggerApi();

    const snapshotResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 424, url: 'https://example.com' },
      { name: 'host_page_snapshot', params: {}, id: 'call-coordinate-1' },
    );
    const snapshot = parseContent(snapshotResponse).result as Record<
      string,
      unknown
    >;
    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 424, url: 'https://example.com' },
      {
        name: 'host_page_pointer',
        params: {
          pageStateId: snapshot.pageStateId,
          documentRef: 'd1',
          action: 'click',
          x: 80,
          y: 56,
          coordinateSpace: 'viewport-css-px',
          targetText: 'Open',
        },
        id: 'call-coordinate-2',
      },
    );
    const content = parseContent(response);

    expect(response.status).toBe('error');
    expect(content).toMatchObject({
      code: 'coordinate_target_ambiguous',
      dispatched: false,
      outcome: 'rejected_before_execution',
      resolution: {
        strategy: 'coordinate',
        candidates: [
          expect.objectContaining({ name: 'Open' }),
          expect.objectContaining({ name: 'Open' }),
        ],
      },
    });
    expect(debuggerApi.sendCommand).not.toHaveBeenCalledWith(
      { tabId: 424 },
      'Input.dispatchMouseEvent',
      expect.anything(),
    );
  });

  it('rejects a strict accessibility target instead of using its center', async () => {
    document.body.innerHTML = '<button id="execute">Execute</button>';
    const button = document.querySelector('button');
    if (!button) throw new Error('AX button fixture is unavailable.');
    mockRect(button, createDomRect(40, 60, 140, 36));
    document.elementsFromPoint = vi.fn(() => [document.body]);
    const sendCommand = vi.fn(async (_target, method, commandParams) => {
      if (method === 'Runtime.evaluate') {
        const expression =
          commandParams && typeof commandParams.expression === 'string'
            ? commandParams.expression
            : '';
        return { result: { value: await eval(expression) } };
      }
      if (method === 'Accessibility.getFullAXTree') {
        return {
          nodes: [
            {
              nodeId: 'ax-execute',
              backendDOMNodeId: 17,
              role: { value: 'button' },
              name: { value: 'Execute' },
            },
          ],
        };
      }
      if (method === 'DOMSnapshot.captureSnapshot') return { documents: [] };
      if (method === 'DOM.resolveNode') {
        return { object: { objectId: 'button-object' } };
      }
      if (method === 'Runtime.callFunctionOn') {
        const declaration =
          commandParams && typeof commandParams.functionDeclaration === 'string'
            ? commandParams.functionDeclaration
            : '';
        const fn = eval(`(${declaration})`) as (
          this: Element,
          rawArgs?: unknown,
        ) => unknown;
        const args = commandParams?.arguments as
          | Array<{ value?: unknown }>
          | undefined;
        return { result: { value: await fn.call(button, args?.[0]?.value) } };
      }
      return {};
    });
    const debuggerApi = createDebuggerApi(sendCommand);

    const snapshotResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 425, url: 'https://example.com' },
      { name: 'host_page_snapshot', params: {}, id: 'call-ax-strict-1' },
    );
    const snapshot = parseContent(snapshotResponse).result as Record<
      string,
      unknown
    >;
    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 425, url: 'https://example.com' },
      {
        name: 'host_page_click',
        params: {
          pageStateId: snapshot.pageStateId,
          documentRef: 'd1',
          axRef: 'ax-execute',
        },
        id: 'call-ax-strict-2',
      },
    );
    const content = parseContent(response);

    expect(response.status).toBe('error');
    expect(content).toMatchObject({
      code: 'target_occluded',
      dispatched: false,
      outcome: 'rejected_before_execution',
      resolution: {
        strategy: 'ax_ref',
        pageStateId: snapshot.pageStateId,
      },
    });
    expect(sendCommand).not.toHaveBeenCalledWith(
      { tabId: 425 },
      'Input.dispatchMouseEvent',
      expect.anything(),
    );
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

  it('captures visible labels, group labels, and select options in runtime snapshots', async () => {
    document.body.innerHTML = `
      <form>
        <strong id="education-label">Highest level of education</strong><br />
        <input id="radio-button-1" type="radio" aria-label="Radio button" value="radio-button-1" /> High School<br />
        <input id="radio-button-2" type="radio" aria-label="Radio button" value="radio-button-2" /> College<br />

        <strong id="sex-label">Sex</strong><br />
        <input id="checkbox-1" type="checkbox" aria-label="checkbox" value="checkbox-1" /> Male<br />
        <input id="checkbox-2" type="checkbox" aria-label="checkbox" value="checkbox-2" /> Female<br />

        <label id="experience-label" for="select-menu">Years of experience:</label>
        <select id="select-menu">
          <option value="0">Select an option</option>
          <option value="1">0-1</option>
          <option value="2">2-4</option>
        </select>
      </form>
    `;
    const educationLabel = document.getElementById('education-label');
    const radioHighSchool = document.getElementById('radio-button-1');
    const radioCollege = document.getElementById('radio-button-2');
    const sexLabel = document.getElementById('sex-label');
    const checkboxMale = document.getElementById('checkbox-1');
    const checkboxFemale = document.getElementById('checkbox-2');
    const select = document.getElementById('select-menu');
    if (
      !educationLabel ||
      !radioHighSchool ||
      !radioCollege ||
      !sexLabel ||
      !checkboxMale ||
      !checkboxFemale ||
      !select
    ) {
      throw new Error('labelled control fixture is unavailable.');
    }
    mockRect(educationLabel, createDomRect(128, 456, 184, 20));
    mockRect(radioHighSchool, createDomRect(128, 486, 13, 13));
    mockRect(radioCollege, createDomRect(128, 510, 13, 13));
    mockRect(sexLabel, createDomRect(128, 586, 32, 20));
    mockRect(checkboxMale, createDomRect(128, 614, 13, 13));
    mockRect(checkboxFemale, createDomRect(128, 638, 13, 13));
    mockRect(select, createDomRect(128, 736, 280, 38));
    document.elementsFromPoint = vi.fn((x, y) => {
      const hit = [
        radioHighSchool,
        radioCollege,
        checkboxMale,
        checkboxFemale,
        select,
      ].find((element) => {
        const rect = element.getBoundingClientRect();
        return (
          x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
        );
      });
      return hit ? [hit, document.body] : [document.body];
    });
    const debuggerApi = createRuntimeEvalDebuggerApi();

    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 42, url: 'https://example.com' },
      { name: 'host_page_snapshot', params: {}, id: 'call-1' },
    );
    const content = parseContent(response);
    const elements = content.result.elements as Array<Record<string, unknown>>;
    const highSchool = elements.find(
      (element) => element.selector === '#radio-button-1',
    );
    const female = elements.find(
      (element) => element.selector === '#checkbox-2',
    );
    const experience = elements.find(
      (element) => element.selector === '#select-menu',
    );

    expect(response.status).toBe('success');
    expect(highSchool).toMatchObject({
      role: 'radio',
      name: 'High School',
      label: 'High School',
      groupLabel: 'Highest level of education',
      value: 'radio-button-1',
    });
    expect(female).toMatchObject({
      role: 'checkbox',
      name: 'Female',
      label: 'Female',
      groupLabel: 'Sex',
      value: 'checkbox-2',
    });
    expect(experience).toMatchObject({
      role: 'combobox',
      name: 'Years of experience:',
      label: 'Years of experience:',
      value: '0',
      selectedLabel: 'Select an option',
      options: [
        { label: 'Select an option', value: '0', selected: true },
        { label: '0-1', value: '1' },
        { label: '2-4', value: '2' },
      ],
    });
  });

  it('captures readable content and reads a block through CDP', async () => {
    document.body.innerHTML = `
      <section id="facts">
        <div><strong>布料類型</strong><span>100% 棉</span></div>
        <div><strong>保養說明</strong><span>機洗</span></div>
      </section>
      <h3>關於這個商品</h3>
      <ul id="about">
        <li>這款孔眼上衣採用 100% 優質棉製成。</li>
        <li>可愛的前綁帶設計,精緻孔眼。</li>
        <li>寬鬆剪裁,提供不受限制的舒適度。</li>
      </ul>
    `;
    mockVisibleTree();
    const debuggerApi = createRuntimeEvalDebuggerApi();

    const snapshotResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 42, url: 'https://example.com' },
      { name: 'host_page_snapshot', params: {}, id: 'call-1' },
    );
    const snapshotContent = parseContent(snapshotResponse);
    const readableContent = snapshotContent.result.readableContent as Record<
      string,
      unknown
    >;
    const blocks = readableContent.blocks as Array<Record<string, unknown>>;
    const listBlock = blocks.find((block) => block.type === 'list');
    const listBlockId = listBlock?.blockId;

    expect(readableContent.coverage).toMatchObject({
      visibleTextCaptured: true,
    });
    expect(blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'keyValueList',
          preview: expect.arrayContaining([
            '布料類型: 100% 棉',
            '保養說明: 機洗',
          ]),
        }),
      ]),
    );
    expect(
      blocks.some(
        (block) =>
          'text' in block ||
          'items' in block ||
          'fields' in block ||
          'headers' in block ||
          'rows' in block ||
          'selector' in block,
      ),
    ).toBe(false);
    expect(readableContent.outline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blockId: listBlockId,
          type: 'list',
          heading: '關於這個商品',
          itemCount: 3,
        }),
      ]),
    );
    expect(
      (readableContent.outline as Array<Record<string, unknown>>).some(
        (item) =>
          'text' in item ||
          'items' in item ||
          'fields' in item ||
          'headers' in item ||
          'rows' in item,
      ),
    ).toBe(false);
    expect(readableContent.suggestedReads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blockId: listBlockId,
          type: 'list',
          reason: 'preview_incomplete',
          args: {
            blockId: listBlockId,
            pageSize: 3,
          },
        }),
      ]),
    );
    expect(listBlock).toMatchObject({
      heading: '關於這個商品',
      readHint: {
        tool: 'host_page_read',
        args: {
          blockId: expect.any(String),
        },
      },
    });

    const readResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 42, url: 'https://example.com' },
      {
        name: 'host_page_read',
        params: {
          blockId: listBlock?.blockId,
          pageSize: 2,
        },
        id: 'call-2',
      },
    );
    const readContent = parseContent(readResponse);

    expect(readContent.result).toMatchObject({
      blockId: listBlock?.blockId,
      type: 'list',
      items: [
        '這款孔眼上衣採用 100% 優質棉製成。',
        '可愛的前綁帶設計,精緻孔眼。',
      ],
      page: 1,
      pageSize: 2,
      pageCount: 2,
      nextPage: 2,
    });
  });

  it('keeps CDP readable content reads within maxChars', async () => {
    document.body.innerHTML = `
      <h3>關於這個商品</h3>
      <ul id="about">
        ${Array.from(
          { length: 24 },
          (_, index) =>
            `<li>第 ${index + 1} 条商品描述 ${'長內容'.repeat(80)}</li>`,
        ).join('')}
      </ul>
    `;
    mockVisibleTree();
    const debuggerApi = createRuntimeEvalDebuggerApi();

    const snapshotResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 42, url: 'https://example.com' },
      { name: 'host_page_snapshot', params: {}, id: 'call-1' },
    );
    const snapshotContent = parseContent(snapshotResponse);
    const readableContent = snapshotContent.result.readableContent as Record<
      string,
      unknown
    >;
    const blocks = readableContent.blocks as Array<Record<string, unknown>>;
    const listBlock = blocks.find((block) => block.type === 'list');

    const readResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 42, url: 'https://example.com' },
      {
        name: 'host_page_read',
        params: {
          blockId: listBlock?.blockId,
          pageSize: 24,
          maxChars: 500,
        },
        id: 'call-2',
      },
    );
    const readContent = parseContent(readResponse);

    expect(JSON.stringify(readContent.result).length).toBeLessThanOrEqual(500);
    expect(readContent.result).toMatchObject({
      blockId: listBlock?.blockId,
      type: 'list',
      truncated: true,
    });
  });

  it('uses normalized pointer coordinates and returns click expectation results', async () => {
    document.body.innerHTML = `
      <button id="department-option">智造技术研究部</button>
      <label>部门名称 <input id="department-name" value="" /></label>
    `;
    const option = document.getElementById('department-option');
    const field = document.querySelector<HTMLInputElement>('#department-name');
    if (!option || !field) {
      throw new Error('department fixture is unavailable.');
    }
    mockRect(option, createDomRect(400, 300, 120, 40));
    option.addEventListener('click', () => {
      field.value = '智造技术研究部';
    });
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 600,
    });
    document.elementsFromPoint = vi.fn(() => [option, document.body]);
    document.elementFromPoint = vi.fn(() => option);
    const debuggerApi = createDebuggerApi(
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
        if (
          method === 'Input.dispatchMouseEvent' &&
          commandParams &&
          typeof commandParams === 'object' &&
          'type' in commandParams &&
          commandParams.type === 'mouseReleased'
        ) {
          option.click();
        }
        return {};
      }),
    );

    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 42, url: 'https://example.com' },
      {
        name: 'host_page_pointer',
        params: {
          coordinateSpace: 'viewport_normalized',
          x: 0.42,
          y: 0.57,
          targetText: '智造技术研究部',
          expectedAfterClick: {
            type: 'field_contains',
            field: '部门名称',
            value: '智造技术研究部',
          },
        },
        id: 'call-1',
      },
    );
    const content = parseContent(response);

    expect(content.result).toMatchObject({
      pointer: 'click',
      coordinateSpace: 'viewport-css-px',
      point: { x: 420, y: 342 },
      targetTextMatched: true,
      expectedAfterClick: {
        ok: true,
        type: 'field_contains',
        field: '部门名称',
        value: '智造技术研究部',
        actual: '智造技术研究部',
      },
    });
  });

  it('rejects pointer clicks when the hit target does not match targetText', async () => {
    document.body.innerHTML = `
      <button id="department-option">项目交付部</button>
      <button id="itinerary-cell">行程明细</button>
    `;
    const option = document.getElementById('department-option');
    const itineraryCell = document.getElementById('itinerary-cell');
    if (!option || !itineraryCell) {
      throw new Error('pointer mismatch fixture is unavailable.');
    }
    const optionClick = vi.fn();
    option.addEventListener('click', optionClick);
    document.elementFromPoint = vi.fn(() => itineraryCell);
    const debuggerApi = createRuntimeEvalDebuggerApi();

    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 42, url: 'https://example.com' },
      {
        name: 'host_page_pointer',
        params: {
          x: 10,
          y: 10,
          targetText: '项目交付部',
        },
        id: 'call-1',
      },
    );
    const content = parseContent(response);

    expect(content.ok).toBe(false);
    expect(content.error).toContain('Pointer target text mismatch');
    expect(optionClick).not.toHaveBeenCalled();
  });

  it('rejects explicit coordinate clicks without targetText', async () => {
    document.body.innerHTML = `<button id="menu">其他菜单</button>`;
    const menu = document.getElementById('menu');
    if (!menu) {
      throw new Error('menu fixture is unavailable.');
    }
    const menuClick = vi.fn();
    menu.addEventListener('click', menuClick);
    document.elementFromPoint = vi.fn(() => menu);
    const debuggerApi = createRuntimeEvalDebuggerApi();

    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 42, url: 'https://example.com' },
      {
        name: 'host_page_pointer',
        params: {
          x: 10,
          y: 10,
        },
        id: 'call-1',
      },
    );
    const content = parseContent(response);

    expect(content.ok).toBe(false);
    expect(content.error).toContain(
      'Pointer coordinate clicks require targetText',
    );
    expect(menuClick).not.toHaveBeenCalled();
  });

  it('rejects explicit coordinate clicks with blank targetText', async () => {
    document.body.innerHTML = `<button id="menu">其他菜单</button>`;
    const menu = document.getElementById('menu');
    if (!menu) {
      throw new Error('menu fixture is unavailable.');
    }
    const menuClick = vi.fn();
    menu.addEventListener('click', menuClick);
    document.elementFromPoint = vi.fn(() => menu);
    const debuggerApi = createRuntimeEvalDebuggerApi();

    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 42, url: 'https://example.com' },
      {
        name: 'host_page_pointer',
        params: {
          x: 10,
          y: 10,
          targetText: '   ',
        },
        id: 'call-1',
      },
    );
    const content = parseContent(response);

    expect(content.ok).toBe(false);
    expect(content.error).toContain(
      'Pointer coordinate clicks require targetText',
    );
    expect(menuClick).not.toHaveBeenCalled();
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
    expect(findVisualEffectEvaluationIndex(sendCommand)).toBeGreaterThan(-1);
    expect(findVisualEffectEvaluationIndex(sendCommand)).toBeLessThan(
      findFirstMouseEventIndex(sendCommand),
    );
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

  it('does not inject readable content extraction into non-reading CDP actions', async () => {
    const runtimeExpressions: string[] = [];
    const sendCommand = vi.fn(async (_target, method, commandParams) => {
      if (method === 'Runtime.evaluate') {
        const expression =
          commandParams && typeof commandParams.expression === 'string'
            ? commandParams.expression
            : '';
        runtimeExpressions.push(expression);
        if (expression.includes('data-xpertai-chatkit-visual-effect')) {
          return { result: { value: undefined } };
        }
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

    await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 42, url: 'https://example.com' },
      { name: 'host_page_click', params: { role: 'button', name: 'Save' } },
    );

    expect(runtimeExpressions.length).toBeGreaterThan(0);
    expect(
      runtimeExpressions.some((expression) =>
        expression.includes('pageResolveTargetScript'),
      ),
    ).toBe(true);
    expect(
      runtimeExpressions.some((expression) =>
        expression.includes('pageReadableContentScript'),
      ),
    ).toBe(false);
  });

  it('re-measures the CDP click point after the target-anchored effect', async () => {
    let resolveCount = 0;
    const sendCommand = vi.fn(async (_target, method, commandParams) => {
      if (method === 'Runtime.evaluate') {
        const expression =
          commandParams && typeof commandParams.expression === 'string'
            ? commandParams.expression
            : '';
        if (expression.includes('data-xpertai-chatkit-visual-effect')) {
          return { result: { value: undefined } };
        }
        resolveCount += 1;
        return {
          result: {
            value: {
              point:
                resolveCount === 1 ? { x: 120, y: 40 } : { x: 222, y: 333 },
              target: { tag: 'button', name: 'Save' },
              requested: { tag: 'button', name: 'Save' },
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
    const content = parseContent(response);

    expect(response.status).toBe('success');
    expect(content).toMatchObject({
      ok: true,
      result: {
        point: { x: 222, y: 333 },
      },
    });
    expect(sendCommand).toHaveBeenCalledWith(
      { tabId: 42 },
      'Input.dispatchMouseEvent',
      expect.objectContaining({ type: 'mousePressed', x: 222, y: 333 }),
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

  it('shows CDP visual effects before hover mouse events', async () => {
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
      { name: 'host_page_hover', params: { role: 'button', name: 'Save' } },
    );

    expect(response.status).toBe('success');
    expect(findVisualEffectEvaluationIndex(sendCommand)).toBeGreaterThan(-1);
    expect(findVisualEffectEvaluationIndex(sendCommand)).toBeLessThan(
      findFirstMouseEventIndex(sendCommand),
    );
  });

  it('shows CDP visual effects before key presses', async () => {
    const sendCommand = vi.fn(async (_target, method) => {
      if (method === 'Runtime.evaluate') {
        return {
          result: {
            value: {
              focused: { tag: 'button', name: 'Save' },
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
      { name: 'host_page_press', params: { key: 'Enter' } },
    );

    expect(response.status).toBe('success');
    expect(findVisualEffectEvaluationIndex(sendCommand)).toBeGreaterThan(-1);
    expect(findVisualEffectEvaluationIndex(sendCommand)).toBeLessThan(
      findFirstKeyEventIndex(sendCommand),
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
          targetText: 'Execute',
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
    expect(findVisualEffectEvaluationIndex(sendCommand)).toBeGreaterThan(-1);
    expect(findVisualEffectEvaluationIndex(sendCommand)).toBeLessThan(
      findFirstMouseEventIndex(sendCommand),
    );
  });

  it('shows CDP visual effects before non-click pointer events', async () => {
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
          action: 'down',
          x: 320,
          y: 480,
        },
      },
    );

    expect(response.status).toBe('success');
    expect(findVisualEffectEvaluationIndex(sendCommand)).toBeGreaterThan(-1);
    expect(findVisualEffectEvaluationIndex(sendCommand)).toBeLessThan(
      findFirstMouseEventIndex(sendCommand),
    );
    expect(sendCommand).toHaveBeenCalledWith(
      { tabId: 42 },
      'Input.dispatchMouseEvent',
      expect.objectContaining({ type: 'mousePressed', x: 320, y: 480 }),
    );
  });

  it('continues CDP clicks when the click effect injection fails', async () => {
    const sendCommand = vi.fn(async (_target, method, commandParams) => {
      if (method === 'Runtime.evaluate') {
        const expression =
          commandParams && typeof commandParams.expression === 'string'
            ? commandParams.expression
            : '';
        if (expression.includes('data-xpertai-chatkit-visual-effect')) {
          return { exceptionDetails: { text: 'effect failed' } };
        }
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
      expect.objectContaining({ type: 'mousePressed', x: 120, y: 40 }),
    );
  });

  it('shows CDP visual effects before fill scripts', async () => {
    const sendCommand = vi.fn(async (_target, method) => {
      if (method === 'Runtime.evaluate') {
        return {
          result: {
            value: {
              point: { x: 120, y: 40 },
              target: { tag: 'input', name: 'Name' },
              requested: { tag: 'input', name: 'Name' },
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
      { name: 'host_page_fill', params: { selector: '#name', value: 'Ada' } },
    );

    expect(response.status).toBe('success');
    expect(findVisualEffectEvaluationIndex(sendCommand)).toBeGreaterThan(-1);
    expect(findVisualEffectEvaluationIndex(sendCommand)).toBeLessThan(
      findRuntimeEvaluationIndexContaining(
        sendCommand,
        'Target element cannot be filled.',
      ),
    );
  });

  it('shows CDP visual effects before page scroll wheel events', async () => {
    const sendCommand = vi.fn(async () => ({}));
    const debuggerApi = createDebuggerApi(sendCommand);

    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 42, url: 'https://example.com' },
      { name: 'host_page_scroll', params: { deltaY: 240 } },
    );

    expect(response.status).toBe('success');
    expect(findVisualEffectEvaluationIndex(sendCommand)).toBeGreaterThan(-1);
    expect(findVisualEffectEvaluationIndex(sendCommand)).toBeLessThan(
      findFirstMouseEventIndex(sendCommand),
    );
  });

  it('shows CDP visual effects before wait_for scripts', async () => {
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
      {
        name: 'host_page_wait_for',
        params: { role: 'button', name: 'Save', state: 'visible' },
      },
    );

    expect(response.status).toBe('success');
    expect(findVisualEffectEvaluationIndex(sendCommand)).toBeGreaterThan(-1);
    expect(findVisualEffectEvaluationIndex(sendCommand)).toBeLessThan(
      findRuntimeEvaluationIndexContaining(
        sendCommand,
        'Timed out waiting for target',
      ),
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

  it('validates pointer target text inside same-origin iframes', async () => {
    installSameOriginFrameFixture();
    const debuggerApi = createRuntimeEvalDebuggerApi();

    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 42, url: 'https://example.com' },
      {
        name: 'host_page_pointer',
        params: {
          x: 440,
          y: 565,
          targetText: '执行',
        },
      },
    );
    const content = parseContent(response);

    expect(response.status).toBe('success');
    expect(content).toMatchObject({
      ok: true,
      result: {
        pointer: 'click',
        point: { x: 440, y: 565 },
        targetTextMatched: true,
        hitTarget: { tag: 'button', role: 'button', name: '执行' },
      },
    });
  });

  it('rejects strict coordinate targeting of an inaccessible frame element', async () => {
    document.body.innerHTML =
      '<iframe id="payment-frame" role="button" aria-label="Payment"></iframe>';
    const frame = document.getElementById('payment-frame');
    if (!(frame instanceof HTMLIFrameElement)) {
      throw new Error('inaccessible CDP frame fixture is unavailable.');
    }
    Object.defineProperty(frame, 'contentDocument', {
      configurable: true,
      get: () => null,
    });
    mockRect(frame, createDomRect(20, 30, 300, 200));
    document.elementsFromPoint = vi.fn(() => [frame, document.body]);
    const debuggerApi = createRuntimeEvalDebuggerApi();
    const snapshotResponse = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 426, url: 'https://example.com' },
      { name: 'host_page_snapshot', params: {}, id: 'call-frame-snapshot' },
    );
    const snapshot = parseContent(snapshotResponse).result as Record<
      string,
      unknown
    >;

    const response = await runCdpHostAutomation(
      { debugger: debuggerApi },
      { id: 426, url: 'https://example.com' },
      {
        name: 'host_page_pointer',
        params: {
          pageStateId: snapshot.pageStateId,
          documentRef: 'd1',
          action: 'click',
          x: 100,
          y: 100,
          coordinateSpace: 'viewport-css-px',
          targetText: 'Payment',
          targetRole: 'button',
        },
        id: 'call-frame-pointer',
      },
    );
    const content = parseContent(response);

    expect(response.status).toBe('error');
    expect(content).toMatchObject({
      ok: false,
      code: 'unsupported_target_scope',
      dispatched: false,
      outcome: 'rejected_before_execution',
    });
    expect(debuggerApi.sendCommand).not.toHaveBeenCalledWith(
      { tabId: 426 },
      'Input.dispatchMouseEvent',
      expect.anything(),
    );
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
    expect(findVisualEffectEvaluationIndex(sendCommand)).toBeGreaterThan(
      findFirstScreenshotIndex(sendCommand),
    );
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
