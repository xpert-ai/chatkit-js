import { describe, expect, it, vi } from 'vitest';

import { HostPageAutomationExecutor } from './executor';

function parseToolContent(value: unknown) {
  return typeof value === 'string' ? JSON.parse(value) : value;
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
