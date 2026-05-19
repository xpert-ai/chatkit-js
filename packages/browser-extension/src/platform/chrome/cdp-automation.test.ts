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
