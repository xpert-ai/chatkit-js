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

  it('maps failed postcondition outcomes to error tool messages', async () => {
    document.body.innerHTML = `
      <button id="save">Save</button>
      <input data-testid="status" value="pending" />
      <input data-testid="status" value="pending" />
    `;
    const button = document.getElementById('save');
    if (!button) {
      throw new Error('Missing button element.');
    }
    mockRect(button, createDomRect(10, 20, 80, 30));
    const restoreElementsFromPoint = mockElementsFromPoint([button]);
    const handler = createHostPageAutomationClientToolHandler();
    const snapshotResponse = await handler({
      name: 'host_page_snapshot',
      id: 'snapshot-1',
    });
    const snapshot = readContent(snapshotResponse.content).result;

    try {
      const response = await handler({
        name: 'host_page_click',
        id: 'click-1',
        params: {
          pageStateId: snapshot.pageStateId,
          documentRef: snapshot.documents[0].documentRef,
          ref: snapshot.elements[0].ref,
          expectation: {
            type: 'field_contains',
            target: {
              documentScope: 'same_document',
              documentRef: snapshot.documents[0].documentRef,
              kind: 'test_id',
              testId: 'status',
            },
            value: 'saved',
          },
        },
      });

      expect(response.status).toBe('error');
      expect(readContent(response.content)).toMatchObject({
        ok: false,
        result: {
          dispatched: true,
          outcome: 'verification_failed',
          verification: { status: 'failed' },
          evidence: {
            timestamp: expect.any(String),
            pageStateId: snapshot.pageStateId,
            action: 'host_page_click',
            outcome: 'verification_failed',
            requested: expect.objectContaining({
              kind: 'ref',
              ref: snapshot.elements[0].ref,
            }),
            resolution: expect.objectContaining({
              strategy: 'ref',
              pageStateId: snapshot.pageStateId,
            }),
            verification: { status: 'failed' },
          },
        },
      });
    } finally {
      restoreElementsFromPoint();
    }
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
    expect(readContent(response.content)).toMatchObject({
      code: 'stale_target',
      outcome: 'rejected_before_execution',
      dispatched: false,
    });
  });

  it('preserves browser approval tokens for the server HITL flow', async () => {
    document.body.innerHTML = `<input id="password" type="password" />`;
    const handler = createHostPageAutomationClientToolHandler();
    const snapshotResponse = await handler({
      name: 'host_page_snapshot',
      params: {},
      id: 'snapshot-approval-1',
    });
    const snapshotContent = readContent(snapshotResponse.content) as {
      result: {
        pageStateId: string;
        documents: Array<{ documentRef: string }>;
        elements: Array<{ ref: string; documentRef: string; tag: string }>;
      };
    };
    const target = snapshotContent.result.elements.find(
      (element) => element.tag === 'input',
    );

    const response = await handler({
      name: 'host_page_fill',
      params: {
        pageStateId: snapshotContent.result.pageStateId,
        documentRef: target?.documentRef,
        ref: target?.ref,
        value: 'secret',
      },
      id: 'fill-approval-1',
    });

    expect(response.status).toBe('error');
    expect(readContent(response.content)).toMatchObject({
      ok: false,
      code: 'approval_required',
      dispatched: false,
      actionToken: expect.any(String),
      risks: ['password_input'],
    });
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
