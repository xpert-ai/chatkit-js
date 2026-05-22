import { describe, expect, it, vi } from 'vitest';

import { createHostPageAutomationClientToolHandler } from './handler';

function readContent(content: unknown) {
  return typeof content === 'string' ? JSON.parse(content) : content;
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

describe('createHostPageAutomationClientToolHandler', () => {
  it('returns successful client tool messages', async () => {
    document.body.innerHTML = `<button id="save">Save</button>`;
    const handler = createHostPageAutomationClientToolHandler();

    const response = await handler({
      name: 'host_page_snapshot',
      params: {},
      id: 'call-1',
    });

    expect(response).toMatchObject({
      tool_call_id: 'call-1',
      name: 'host_page_snapshot',
      status: 'success',
    });
    expect(readContent(response.content)).toMatchObject({
      ok: true,
      result: { title: document.title },
    });
  });

  it('returns tool errors for unknown tools', async () => {
    const handler = createHostPageAutomationClientToolHandler();

    const response = await handler({
      name: 'unknown_tool',
      params: {},
      id: 'call-2',
    });

    expect(response.status).toBe('error');
    expect(readContent(response.content)).toMatchObject({
      ok: false,
    });
  });

  it('converts execution errors into tool error messages', async () => {
    const handler = createHostPageAutomationClientToolHandler();

    const response = await handler({
      name: 'host_page_click',
      params: { ref: 'missing' },
      tool_call_id: 'tool-call-1',
    });

    expect(response).toMatchObject({
      tool_call_id: 'tool-call-1',
      status: 'error',
    });
    expect(readContent(response.content).error).toContain(
      'Unknown element ref',
    );
  });

  it('preserves structured occlusion details in tool error messages', async () => {
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
    const handler = createHostPageAutomationClientToolHandler();

    try {
      const response = await handler({
        name: 'host_page_click',
        params: { selector: '#save' },
        id: 'call-3',
      });
      const content = readContent(response.content);

      expect(response.status).toBe('error');
      expect(content).toMatchObject({
        ok: false,
        reason: 'target_occluded',
        occluder: expect.objectContaining({
          selector: '#overlay',
        }),
        recoverable: true,
      });
    } finally {
      restoreElementsFromPoint();
    }
  });
});
