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
