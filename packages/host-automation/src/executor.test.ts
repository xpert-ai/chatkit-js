import { describe, expect, it, vi } from 'vitest';

import { HostPageAutomationExecutor } from './executor';

function parseToolContent(value: unknown) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function mockRect(element: Element, rect: DOMRect) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => rect,
  });
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

function mockElementFromPoint(element: Element): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(
    document,
    'elementFromPoint',
  );
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: vi.fn(() => element),
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(document, 'elementFromPoint', descriptor);
    } else {
      delete (document as unknown as Record<string, unknown>).elementFromPoint;
    }
  };
}

function mockElementsFromPoint(elements: Element[]): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(
    document,
    'elementsFromPoint',
  );
  Object.defineProperty(document, 'elementsFromPoint', {
    configurable: true,
    value: vi.fn(() => elements),
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(document, 'elementsFromPoint', descriptor);
    } else {
      delete (document as unknown as Record<string, unknown>).elementsFromPoint;
    }
  };
}

function mockVisibleTree(root: ParentNode = document.body) {
  Array.from(root.querySelectorAll('*')).forEach((element, index) => {
    mockRect(element, createDomRect(10, 10 + index * 24, 320, 20));
  });
}

describe('HostPageAutomationExecutor', () => {
  it('captures a page snapshot and keeps refs usable until the next snapshot', async () => {
    document.body.innerHTML = `
      <button id="save">Save</button>
      <label>Name <input name="name" value="Ada" /></label>
    `;
    const executor = new HostPageAutomationExecutor();

    const snapshot = executor.snapshot();

    expect(snapshot.url).toBe(window.location.href);
    expect(snapshot.elements.map((element) => element.name)).toContain('Save');

    const input = snapshot.elements.find((element) => element.tag === 'input');
    expect(input?.ref).toBeTruthy();

    await executor.execute('host_page_fill', {
      ref: input?.ref,
      value: 'Grace',
    });

    expect(
      document.querySelector<HTMLInputElement>('input[name="name"]')?.value,
    ).toBe('Grace');
  });

  it('clicks a target by ref', async () => {
    document.body.innerHTML = `<button id="save">Save</button>`;
    const click = vi.fn();
    document.getElementById('save')?.addEventListener('click', click);
    const executor = new HostPageAutomationExecutor();
    const button = executor.snapshot().elements[0];

    await executor.execute('host_page_click', { ref: button?.ref });

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('shows the optional click effect before clicking a target', async () => {
    document.body.innerHTML = `<button id="save">Save</button>`;
    const buttonElement = document.getElementById('save');
    if (!buttonElement) {
      throw new Error('Missing button element.');
    }
    mockRect(buttonElement, createDomRect(10, 20, 80, 30));
    const restoreElementFromPoint = mockElementFromPoint(buttonElement);
    const events: string[] = [];
    buttonElement.addEventListener('click', () => {
      events.push('click');
    });
    const showClickEffect = vi.fn(({ point, target, requested }) => {
      events.push('effect');
      expect(point).toEqual({ x: 50, y: 35 });
      expect(target).toBe(buttonElement);
      expect(requested).toBe(buttonElement);
    });
    const executor = new HostPageAutomationExecutor({ showClickEffect });
    const button = executor.snapshot().elements[0];

    try {
      await executor.execute('host_page_click', { ref: button?.ref });
    } finally {
      restoreElementFromPoint();
    }

    expect(showClickEffect).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['effect', 'click']);
  });

  it('uses the post-scroll target position for click effects', async () => {
    document.body.innerHTML = `<button id="save">Save</button>`;
    const buttonElement = document.getElementById('save');
    if (!buttonElement) {
      throw new Error('Missing button element.');
    }
    let rect = createDomRect(10, 20, 80, 30);
    Object.defineProperty(buttonElement, 'getBoundingClientRect', {
      configurable: true,
      value: () => rect,
    });
    Object.defineProperty(buttonElement, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(() => {
        rect = createDomRect(10, 220, 80, 30);
      }),
    });
    const restoreElementFromPoint = mockElementFromPoint(buttonElement);
    const showClickEffect = vi.fn(({ point }) => {
      expect(point).toEqual({ x: 50, y: 235 });
    });
    const executor = new HostPageAutomationExecutor({ showClickEffect });
    const button = executor.snapshot().elements[0];

    try {
      const result = await executor.execute('host_page_click', {
        ref: button?.ref,
      });

      expect(result).toMatchObject({ point: { x: 50, y: 235 } });
    } finally {
      restoreElementFromPoint();
    }

    expect(showClickEffect).toHaveBeenCalledTimes(1);
  });

  it('continues clicking when the optional click effect fails', async () => {
    document.body.innerHTML = `<button id="save">Save</button>`;
    const buttonElement = document.getElementById('save');
    if (!buttonElement) {
      throw new Error('Missing button element.');
    }
    mockRect(buttonElement, createDomRect(10, 20, 80, 30));
    const restoreElementFromPoint = mockElementFromPoint(buttonElement);
    const click = vi.fn();
    buttonElement.addEventListener('click', click);
    const executor = new HostPageAutomationExecutor({
      showClickEffect: () => {
        throw new Error('effect failed');
      },
    });
    const button = executor.snapshot().elements[0];

    try {
      await executor.execute('host_page_click', { ref: button?.ref });
    } finally {
      restoreElementFromPoint();
    }

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('shows optional visual effects before non-click actions', async () => {
    document.body.innerHTML = `
      <input id="name" />
      <select id="choice"><option value="a">A</option></select>
      <button id="save">Save</button>
      <div id="list"></div>
    `;
    const name = document.querySelector<HTMLInputElement>('#name');
    const choice = document.querySelector<HTMLSelectElement>('#choice');
    const save = document.querySelector<HTMLButtonElement>('#save');
    const list = document.querySelector<HTMLElement>('#list');
    if (!name || !choice || !save || !list) {
      throw new Error('Missing visual effect fixture.');
    }
    mockRect(name, createDomRect(10, 20, 160, 30));
    mockRect(choice, createDomRect(10, 60, 160, 30));
    mockRect(save, createDomRect(10, 100, 80, 30));
    mockRect(list, createDomRect(10, 140, 240, 120));
    const restoreElementFromPoint = mockElementFromPoint(save);
    const effects: string[] = [];
    const executor = new HostPageAutomationExecutor({
      showVisualEffect: (context) => {
        effects.push(
          context.action ? `${context.type}:${context.action}` : context.type,
        );
      },
    });

    try {
      await executor.execute('host_page_fill', {
        selector: '#name',
        value: 'Grace',
      });
      await executor.execute('host_page_select', {
        selector: '#choice',
        value: 'a',
      });
      await executor.execute('host_page_press', {
        selector: '#save',
        key: 'Enter',
      });
      await executor.execute('host_page_scroll', {
        selector: '#list',
        deltaY: 20,
      });
      await executor.execute('host_page_hover', { selector: '#save' });
      await executor.execute('host_page_focus', { selector: '#save' });
      await executor.execute('host_page_wait_for', {
        selector: '#save',
        state: 'visible',
      });
      await executor.execute('host_page_pointer', {
        action: 'move',
        x: 50,
        y: 110,
      });
      await executor.execute('host_page_pointer', {
        action: 'down',
        x: 50,
        y: 110,
      });
      await executor.execute('host_page_pointer', {
        action: 'up',
        x: 50,
        y: 110,
      });
    } finally {
      restoreElementFromPoint();
    }

    expect(effects).toEqual([
      'fill',
      'select',
      'press',
      'scroll',
      'hover',
      'focus',
      'wait_for',
      'pointer:move',
      'pointer:down',
      'pointer:up',
    ]);
    expect(name.value).toBe('Grace');
  });

  it('continues non-click actions when the optional visual effect fails', async () => {
    document.body.innerHTML = `<input id="name" />`;
    const input = document.querySelector<HTMLInputElement>('#name');
    if (!input) {
      throw new Error('Missing input element.');
    }
    const executor = new HostPageAutomationExecutor({
      showVisualEffect: () => {
        throw new Error('effect failed');
      },
    });

    await executor.execute('host_page_fill', {
      selector: '#name',
      value: 'Grace',
    });

    expect(input.value).toBe('Grace');
  });

  it('clicks a target by semantic role and accessible name', async () => {
    document.body.innerHTML = `<div role="button" aria-label="Save changes">Save</div>`;
    const click = vi.fn();
    document.querySelector('[role="button"]')?.addEventListener('click', click);
    const executor = new HostPageAutomationExecutor();

    await executor.execute('host_page_click', {
      role: 'button',
      name: 'Save changes',
    });

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('includes richer page state and actionability metadata in snapshots', () => {
    document.body.innerHTML = `<button data-testid="save-action">Save</button>`;
    const buttonElement = document.querySelector('button');
    if (!buttonElement) {
      throw new Error('Missing button element.');
    }
    vi.spyOn(buttonElement, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 80,
      bottom: 24,
      width: 80,
      height: 24,
      toJSON: () => ({}),
    });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => buttonElement),
    });
    const executor = new HostPageAutomationExecutor();

    const snapshot = executor.snapshot();
    const button = snapshot.elements[0];

    expect(snapshot.capabilities).toMatchObject({
      cdp: false,
      realInput: false,
      screenshot: false,
    });
    expect(snapshot.page?.readyState).toBe(document.readyState);
    expect(snapshot.viewport.devicePixelRatio).toBe(window.devicePixelRatio);
    expect(button).toMatchObject({
      testId: 'save-action',
      enabled: true,
      visible: true,
    });
    expect(Array.isArray(button?.hitStack)).toBe(true);
  });

  it('captures readable page content alongside actionable elements', () => {
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
      <button id="buy">Buy now</button>
    `;
    mockVisibleTree();
    const restoreElementFromPoint = mockElementFromPoint(
      document.getElementById('buy') as Element,
    );
    const executor = new HostPageAutomationExecutor();

    try {
      const snapshot = executor.snapshot();
      const readableContent = snapshot.readableContent;
      const listBlock = readableContent?.blocks.find(
        (block) => block.type === 'list',
      );
      const listBlockId = listBlock?.blockId;

      expect(snapshot.elements.some((element) => element.ref)).toBe(true);
      expect(readableContent?.coverage.visibleTextCaptured).toBe(true);
      expect(readableContent?.blocks).toEqual(
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
        readableContent?.blocks.some(
          (block) =>
            'text' in block ||
            'items' in block ||
            'fields' in block ||
            'headers' in block ||
            'rows' in block ||
            'selector' in block,
        ),
      ).toBe(false);
      expect(readableContent?.outline).toEqual(
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
        readableContent?.outline?.some(
          (item) =>
            'text' in item ||
            'items' in item ||
            'fields' in item ||
            'headers' in item ||
            'rows' in item,
        ),
      ).toBe(false);
      expect(readableContent?.suggestedReads).toEqual(
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
        preview: expect.arrayContaining([
          '這款孔眼上衣採用 100% 優質棉製成。',
        ]),
        readHint: {
          tool: 'host_page_read',
          args: {
            blockId: expect.any(String),
          },
        },
      });
    } finally {
      restoreElementFromPoint();
    }
  });

  it('reads readable content blocks by id with pagination', async () => {
    document.body.innerHTML = `
      <h3>關於這個商品</h3>
      <ul id="about">
        <li>第一条商品描述</li>
        <li>第二条商品描述</li>
        <li>第三条商品描述</li>
      </ul>
    `;
    mockVisibleTree();
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();
    const listBlock = snapshot.readableContent?.blocks.find(
      (block) => block.type === 'list',
    );

    const result = await executor.execute('host_page_read', {
      blockId: listBlock?.blockId,
      pageSize: 2,
    });

    expect(result).toMatchObject({
      blockId: listBlock?.blockId,
      type: 'list',
      items: ['第一条商品描述', '第二条商品描述'],
      page: 1,
      pageSize: 2,
      pageCount: 2,
      nextPage: 2,
    });
  });

  it('keeps readable content reads within maxChars', async () => {
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
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();
    const listBlock = snapshot.readableContent?.blocks.find(
      (block) => block.type === 'list',
    );

    const result = await executor.execute('host_page_read', {
      blockId: listBlock?.blockId,
      pageSize: 24,
      maxChars: 500,
    });

    expect(JSON.stringify(result).length).toBeLessThanOrEqual(500);
    expect(result).toMatchObject({
      blockId: listBlock?.blockId,
      type: 'list',
      truncated: true,
    });
  });

  it('refreshes readable content after page-changing actions', async () => {
    document.body.innerHTML = `
      <button id="change">Change</button>
      <h3>Items</h3>
      <ul id="items"><li>Old item</li></ul>
    `;
    mockVisibleTree();
    const button = document.getElementById('change');
    const item = document.querySelector('#items li');
    if (!button || !item) {
      throw new Error('Missing readable content mutation fixture.');
    }
    button.addEventListener('click', () => {
      item.textContent = 'New item';
      mockVisibleTree();
    });
    const restoreElementFromPoint = mockElementFromPoint(button);
    const executor = new HostPageAutomationExecutor();
    executor.snapshot();

    try {
      await executor.execute('host_page_click', { selector: '#change' });
      const result = await executor.execute('host_page_read', {
        query: 'New item',
      });

      expect(JSON.stringify(result)).toContain('New item');
      expect(JSON.stringify(result)).not.toContain('Old item');
    } finally {
      restoreElementFromPoint();
    }
  });

  it('returns structured occlusion diagnostics when a target cannot receive clicks', async () => {
    document.body.innerHTML = `
      <button id="save">Save</button>
      <div id="overlay" role="dialog">Modal overlay</div>
    `;
    const save = document.getElementById('save');
    const overlay = document.getElementById('overlay');
    if (!save || !overlay) {
      throw new Error('Missing occlusion fixture.');
    }
    mockRect(save, createDomRect(10, 10, 80, 30));
    mockRect(overlay, createDomRect(0, 0, 200, 120));
    const restoreElementsFromPoint = mockElementsFromPoint([
      overlay,
      save,
      document.body,
    ]);
    const executor = new HostPageAutomationExecutor();

    try {
      await expect(
        executor.execute('host_page_click', { selector: '#save' }),
      ).rejects.toMatchObject({
        details: expect.objectContaining({
          reason: 'target_occluded',
          occluder: expect.objectContaining({
            selector: '#overlay',
          }),
          recoverable: true,
        }),
      });
    } finally {
      restoreElementsFromPoint();
    }
  });

  it('uses nearby visible text as context for weakly labelled form fields', () => {
    document.body.innerHTML = `
      <span id="po-label">采购订单</span>
      <input id="po-number" />
    `;
    const label = document.getElementById('po-label');
    const input = document.getElementById('po-number');
    if (!label || !input) {
      throw new Error('Missing test elements.');
    }
    vi.spyOn(label, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 64,
      bottom: 24,
      width: 64,
      height: 24,
      toJSON: () => ({}),
    });
    vi.spyOn(input, 'getBoundingClientRect').mockReturnValue({
      x: 80,
      y: 0,
      left: 80,
      top: 0,
      right: 180,
      bottom: 24,
      width: 100,
      height: 24,
      toJSON: () => ({}),
    });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => input),
    });
    const executor = new HostPageAutomationExecutor();

    const snapshot = executor.snapshot();
    const field = snapshot.elements.find((element) => element.tag === 'input');

    expect(field?.name).toBe('采购订单');
    expect(field?.nearbyText).toContain('采购订单');
  });

  it('adds visible control labels, group labels, and select options to snapshots', () => {
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
    if (
      !educationLabel ||
      !radioHighSchool ||
      !radioCollege ||
      !sexLabel ||
      !checkboxMale ||
      !checkboxFemale
    ) {
      throw new Error('Missing labelled form fixture.');
    }
    mockRect(educationLabel, createDomRect(128, 456, 184, 20));
    mockRect(radioHighSchool, createDomRect(128, 486, 13, 13));
    mockRect(radioCollege, createDomRect(128, 510, 13, 13));
    mockRect(sexLabel, createDomRect(128, 586, 32, 20));
    mockRect(checkboxMale, createDomRect(128, 614, 13, 13));
    mockRect(checkboxFemale, createDomRect(128, 638, 13, 13));
    const executor = new HostPageAutomationExecutor();

    const snapshot = executor.snapshot();
    const highSchool = snapshot.elements.find(
      (element) => element.selector === '#radio-button-1',
    );
    const female = snapshot.elements.find(
      (element) => element.selector === '#checkbox-2',
    );
    const select = snapshot.elements.find(
      (element) => element.selector === '#select-menu',
    );

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
    expect(select).toMatchObject({
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

  it('supports normalized pointer coordinates and verifies expected field content after click', async () => {
    document.body.innerHTML = `
      <button id="department-option">智造技术研究部</button>
      <label>部门名称 <input id="department-name" value="" /></label>
    `;
    const option = document.getElementById('department-option');
    const field = document.querySelector<HTMLInputElement>('#department-name');
    if (!option || !field) {
      throw new Error('Missing department fixture.');
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
    const restoreElementFromPoint = mockElementFromPoint(option);
    const executor = new HostPageAutomationExecutor();

    try {
      const result = await executor.execute('host_page_pointer', {
        coordinateSpace: 'viewport_normalized',
        x: 0.42,
        y: 0.57,
        targetText: '智造技术研究部',
        expectedAfterClick: {
          type: 'field_contains',
          field: '部门名称',
          value: '智造技术研究部',
        },
      });

      expect(result).toMatchObject({
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
    } finally {
      restoreElementFromPoint();
    }
  });

  it('rejects pointer clicks when the hit target does not match targetText', async () => {
    document.body.innerHTML = `
      <button id="department-option">项目交付部</button>
      <button id="itinerary-cell">行程明细</button>
    `;
    const option = document.getElementById('department-option');
    const itineraryCell = document.getElementById('itinerary-cell');
    if (!option || !itineraryCell) {
      throw new Error('Missing pointer mismatch fixture.');
    }
    const optionClick = vi.fn();
    option.addEventListener('click', optionClick);
    const restoreElementFromPoint = mockElementFromPoint(itineraryCell);
    const executor = new HostPageAutomationExecutor();

    try {
      await expect(
        executor.execute('host_page_pointer', {
          x: 10,
          y: 10,
          targetText: '项目交付部',
        }),
      ).rejects.toThrow('Pointer target text mismatch');
      expect(optionClick).not.toHaveBeenCalled();
    } finally {
      restoreElementFromPoint();
    }
  });

  it('rejects explicit coordinate clicks without targetText', async () => {
    document.body.innerHTML = `<button id="menu">其他菜单</button>`;
    const menu = document.getElementById('menu');
    if (!menu) {
      throw new Error('Missing menu fixture.');
    }
    const menuClick = vi.fn();
    menu.addEventListener('click', menuClick);
    const restoreElementFromPoint = mockElementFromPoint(menu);
    const executor = new HostPageAutomationExecutor();

    try {
      await expect(
        executor.execute('host_page_pointer', {
          x: 10,
          y: 10,
        }),
      ).rejects.toThrow('Pointer coordinate clicks require targetText');
      expect(menuClick).not.toHaveBeenCalled();
    } finally {
      restoreElementFromPoint();
    }
  });

  it('fills a target by selector and dispatches input events', async () => {
    document.body.innerHTML = `<input id="name" />`;
    const input = document.querySelector<HTMLInputElement>('#name');
    const onInput = vi.fn();
    input?.addEventListener('input', onInput);
    const executor = new HostPageAutomationExecutor();

    await executor.execute('host_page_fill', {
      selector: '#name',
      value: 'Ada',
    });

    expect(input?.value).toBe('Ada');
    expect(onInput).toHaveBeenCalledTimes(1);
  });

  it('presses a key on a target', async () => {
    document.body.innerHTML = `<button id="save">Save</button>`;
    const keydown = vi.fn();
    document.getElementById('save')?.addEventListener('keydown', keydown);
    const executor = new HostPageAutomationExecutor();

    await executor.execute('host_page_press', {
      selector: '#save',
      key: 'Enter',
    });

    expect(keydown).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'Enter' }),
    );
  });

  it('selects values in a select element', async () => {
    document.body.innerHTML = `
      <select id="city">
        <option value="sh">Shanghai</option>
        <option value="ny">New York</option>
      </select>
    `;
    const executor = new HostPageAutomationExecutor();

    await executor.execute('host_page_select', {
      selector: '#city',
      value: 'ny',
    });

    expect(document.querySelector<HTMLSelectElement>('#city')?.value).toBe(
      'ny',
    );
  });

  it('scrolls a target element', async () => {
    document.body.innerHTML = `<div id="list"></div>`;
    const list = document.getElementById('list');
    if (!list) {
      throw new Error('Missing list element.');
    }
    const scrollBy = vi.fn((xOrOptions?: ScrollToOptions | number, y = 0) => {
      const x = typeof xOrOptions === 'number' ? xOrOptions : 0;
      list.scrollLeft += x;
      list.scrollTop += y;
    });
    list.scrollBy = scrollBy;
    const executor = new HostPageAutomationExecutor();

    await executor.execute('host_page_scroll', {
      selector: '#list',
      deltaX: 5,
      deltaY: 30,
    });

    expect(scrollBy).toHaveBeenCalledWith(5, 30);
    expect(list.scrollTop).toBe(30);
  });

  it('focuses, hovers, and waits for targets', async () => {
    document.body.innerHTML = `<button id="save">Save</button>`;
    const hover = vi.fn();
    document.getElementById('save')?.addEventListener('mouseover', hover);
    const executor = new HostPageAutomationExecutor();

    await executor.execute('host_page_focus', { selector: '#save' });
    await executor.execute('host_page_hover', { selector: '#save' });
    await expect(
      executor.execute('host_page_wait_for', {
        selector: '#save',
        state: 'attached',
        timeoutSeconds: 1,
      }),
    ).resolves.toMatchObject({ waitedFor: 'attached' });

    expect(document.activeElement?.id).toBe('save');
    expect(hover).toHaveBeenCalledTimes(1);
  });

  it('includes elements inside open shadow roots in snapshots', () => {
    document.body.innerHTML = `<div id="host"></div>`;
    const host = document.getElementById('host');
    if (!host) {
      throw new Error('Missing shadow host.');
    }
    host.attachShadow({ mode: 'open' }).innerHTML =
      '<button id="shadow-button">Shadow action</button>';
    const executor = new HostPageAutomationExecutor();

    const snapshot = executor.snapshot();

    expect(snapshot.elements.map((element) => element.name)).toContain(
      'Shadow action',
    );
  });

  it('rejects non-http navigation URLs', async () => {
    const executor = new HostPageAutomationExecutor();

    await expect(
      executor.execute('host_page_navigate', { url: 'chrome://extensions' }),
    ).rejects.toThrow('HTTP(S)');
  });

  it('fails writes when automation is disabled', async () => {
    document.body.innerHTML = `<button>Save</button>`;
    const executor = new HostPageAutomationExecutor({ enabled: false });

    await expect(executor.execute('host_page_snapshot')).rejects.toThrow(
      'disabled',
    );
  });
});
