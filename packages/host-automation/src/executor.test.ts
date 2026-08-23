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

function mockElementsFromPointBy(
  resolve: (x: number, y: number) => Element[],
): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(
    document,
    'elementsFromPoint',
  );
  Object.defineProperty(document, 'elementsFromPoint', {
    configurable: true,
    value: vi.fn(resolve),
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
      pageStateId: snapshot.pageStateId,
      documentRef: input?.documentRef,
      ref: input?.ref,
      value: 'Grace',
    });

    expect(
      document.querySelector<HTMLInputElement>('input[name="name"]')?.value,
    ).toBe('Grace');
  });

  it('rejects actions from an older page state before dispatch', async () => {
    document.body.innerHTML = `<button id="save">Save</button>`;
    const buttonElement = document.getElementById('save');
    if (!buttonElement) {
      throw new Error('Missing button element.');
    }
    const click = vi.fn();
    buttonElement.addEventListener('click', click);
    const executor = new HostPageAutomationExecutor();
    const firstSnapshot = executor.snapshot();
    const button = firstSnapshot.elements[0];

    executor.snapshot();

    await expect(
      executor.execute('host_page_click', {
        pageStateId: firstSnapshot.pageStateId,
        documentRef: button?.documentRef,
        ref: button?.ref,
      }),
    ).rejects.toMatchObject({
      details: expect.objectContaining({
        code: 'stale_page_state',
        dispatched: false,
        outcome: 'rejected_before_execution',
      }),
    });
    expect(click).not.toHaveBeenCalled();
  });

  it('requires page and document identity after a v2 snapshot', async () => {
    document.body.innerHTML = `<button id="save">Save</button>`;
    const click = vi.fn();
    document.getElementById('save')?.addEventListener('click', click);
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();

    await expect(
      executor.execute('host_page_click', {
        ref: snapshot.elements[0]?.ref,
      }),
    ).rejects.toMatchObject({
      details: expect.objectContaining({ code: 'stale_page_state' }),
    });
    await expect(
      executor.execute('host_page_click', {
        pageStateId: snapshot.pageStateId,
        ref: snapshot.elements[0]?.ref,
      }),
    ).rejects.toMatchObject({
      details: expect.objectContaining({ code: 'unsupported_target_scope' }),
    });
    await expect(
      executor.execute('host_page_click', {
        pageStateId: snapshot.pageStateId,
        documentRef: snapshot.elements[0]?.documentRef,
        ref: snapshot.elements[0]?.ref,
        selector: '#save',
      }),
    ).rejects.toMatchObject({
      details: expect.objectContaining({ code: 'ambiguous_target' }),
    });
    expect(click).not.toHaveBeenCalled();
  });

  it('requires the current page state for targetless actions', async () => {
    document.body.innerHTML = `<input id="field" />`;
    const keydown = vi.fn();
    document.getElementById('field')?.addEventListener('keydown', keydown);
    const executor = new HostPageAutomationExecutor();
    executor.snapshot();

    await expect(
      executor.execute('host_page_press', { key: 'Enter' }),
    ).rejects.toMatchObject({
      details: expect.objectContaining({
        code: 'stale_page_state',
        dispatched: false,
        outcome: 'rejected_before_execution',
      }),
    });
    expect(keydown).not.toHaveBeenCalled();
  });

  it('omits resolution for targetless actions', async () => {
    document.body.innerHTML = `<input id="field" />`;
    document.getElementById('field')?.focus();
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();

    const result = await executor.execute('host_page_press', {
      pageStateId: snapshot.pageStateId,
      key: 'Escape',
    });

    expect(result).toMatchObject({
      dispatched: true,
      outcome: 'executed_unverified',
      requiresFreshSnapshot: true,
    });
    expect(result).not.toHaveProperty('resolution');
  });

  it('reuses the same snapshot state for paginated snapshot reads', async () => {
    document.body.innerHTML = `<button id="save">Save</button>`;
    const executor = new HostPageAutomationExecutor();
    const first = await executor.execute('host_page_snapshot', {});
    if (!first || typeof first !== 'object' || !('pageStateId' in first)) {
      throw new Error('Missing first snapshot.');
    }
    const firstSnapshot = first as ReturnType<
      HostPageAutomationExecutor['snapshot']
    >;

    const second = await executor.execute('host_page_snapshot', {
      pageStateId: firstSnapshot.pageStateId,
    });

    expect(second).toMatchObject({
      pageStateId: firstSnapshot.pageStateId,
      elements: [
        expect.objectContaining({ ref: firstSnapshot.elements[0]?.ref }),
      ],
    });
  });

  it('expires cached snapshot state after two minutes', async () => {
    const now = new Date('2026-08-05T00:00:00.000Z').getTime();
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      document.body.innerHTML = `<button id="save">Save</button>`;
      const executor = new HostPageAutomationExecutor();
      const snapshot = executor.snapshot();
      const click = vi.fn();
      document.getElementById('save')?.addEventListener('click', click);

      dateNow.mockReturnValue(now + 2 * 60_000 + 1);

      await expect(
        executor.execute('host_page_snapshot', {
          pageStateId: snapshot.pageStateId,
        }),
      ).rejects.toMatchObject({
        details: expect.objectContaining({
          code: 'stale_page_state',
          requiresFreshSnapshot: true,
          invalidatedPageStateId: snapshot.pageStateId,
        }),
      });
      await expect(
        executor.execute('host_page_click', {
          pageStateId: snapshot.pageStateId,
          documentRef: snapshot.elements[0]?.documentRef,
          ref: snapshot.elements[0]?.ref,
        }),
      ).rejects.toMatchObject({
        details: expect.objectContaining({ code: 'stale_page_state' }),
      });
      expect(click).not.toHaveBeenCalled();
    } finally {
      dateNow.mockRestore();
    }
  });

  it('invalidates the current page state after structural mutations', async () => {
    document.body.innerHTML = `<button id="save">Save</button>`;
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();
    const button = snapshot.elements[0];

    document.body.append(document.createElement('section'));
    await Promise.resolve();

    await expect(
      executor.execute('host_page_click', {
        pageStateId: snapshot.pageStateId,
        documentRef: button?.documentRef,
        ref: button?.ref,
      }),
    ).rejects.toMatchObject({
      details: expect.objectContaining({ code: 'stale_page_state' }),
    });
  });

  it('keeps page state current after unrelated text-only mutations', async () => {
    document.body.innerHTML = `
      <button id="save">Save</button>
      <p id="status">Waiting</p>
    `;
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();
    const button = snapshot.elements.find(
      (element) => element.tag === 'button',
    );
    const status = document.getElementById('status');
    const click = vi.fn();
    document.getElementById('save')?.addEventListener('click', click);
    if (!status?.firstChild) {
      throw new Error('Missing text mutation fixture.');
    }

    status.firstChild.textContent = 'Ready';
    await Promise.resolve();

    await executor.execute('host_page_click', {
      pageStateId: snapshot.pageStateId,
      documentRef: button?.documentRef,
      ref: button?.ref,
    });

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('rejects a ref when its node was replaced without selecting a same-name fallback', async () => {
    document.body.innerHTML = `<button id="save">Save</button>`;
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();
    const original = document.getElementById('save');
    const button = snapshot.elements[0];
    if (!original || !button) {
      throw new Error('Missing button fixture.');
    }
    const replacement = original.cloneNode(true) as HTMLButtonElement;
    const replacementClick = vi.fn();
    replacement.addEventListener('click', replacementClick);
    original.replaceWith(replacement);

    await expect(
      executor.execute('host_page_click', {
        pageStateId: snapshot.pageStateId,
        documentRef: button.documentRef,
        ref: button.ref,
      }),
    ).rejects.toMatchObject({
      details: expect.objectContaining({
        code: 'stale_target',
        dispatched: false,
      }),
    });
    expect(replacementClick).not.toHaveBeenCalled();
  });

  it('clicks a target by ref', async () => {
    document.body.innerHTML = `<button id="save">Save</button>`;
    const click = vi.fn();
    document.getElementById('save')?.addEventListener('click', click);
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();
    const button = snapshot.elements[0];

    await executor.execute('host_page_click', {
      pageStateId: snapshot.pageStateId,
      documentRef: button?.documentRef,
      ref: button?.ref,
    });

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('rejects a target nested inside a disabled actionable ancestor', async () => {
    document.body.innerHTML = `
      <button id="save" disabled><span data-testid="save-icon">Save</span></button>
    `;
    const button = document.getElementById('save');
    if (!button) {
      throw new Error('Missing disabled button fixture.');
    }
    const click = vi.fn();
    button.addEventListener('click', click);
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();

    await expect(
      executor.execute('host_page_click', {
        pageStateId: snapshot.pageStateId,
        documentRef: snapshot.documents[0]?.documentRef,
        testId: 'save-icon',
      }),
    ).rejects.toMatchObject({
      details: expect.objectContaining({
        code: 'target_disabled',
        dispatched: false,
        outcome: 'rejected_before_execution',
      }),
    });
    expect(click).not.toHaveBeenCalled();
  });

  it('requires a single-use approval token before filling a password', async () => {
    document.body.innerHTML = `<input id="password" type="password" />`;
    const field = document.querySelector<HTMLInputElement>('#password');
    if (!field) {
      throw new Error('Missing password field fixture.');
    }
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();
    const target = snapshot.elements.find((element) => element.tag === 'input');
    const params = {
      pageStateId: snapshot.pageStateId,
      documentRef: target?.documentRef,
      ref: target?.ref,
      value: 'correct horse battery staple',
    };

    let actionToken = '';
    try {
      await executor.execute('host_page_fill', params);
      throw new Error('Expected password fill to require approval.');
    } catch (error) {
      expect(error).toMatchObject({
        details: expect.objectContaining({
          code: 'approval_required',
          dispatched: false,
          outcome: 'rejected_before_execution',
          actionToken: expect.any(String),
          risks: ['password_input'],
        }),
      });
      actionToken = (error as { details: { actionToken: string } }).details
        .actionToken;
    }
    expect(field.value).toBe('');

    await expect(
      executor.execute('host_page_fill', {
        ...params,
        value: 'changed secret',
        actionToken,
      }),
    ).rejects.toMatchObject({
      details: expect.objectContaining({
        code: 'approval_required',
        dispatched: false,
        approvalReason: 'action_mismatch',
      }),
    });
    expect(field.value).toBe('');

    let replacementToken = '';
    try {
      await executor.execute('host_page_fill', { ...params, actionToken });
      throw new Error('Expected the consumed approval token to be rejected.');
    } catch (error) {
      expect(error).toMatchObject({
        details: expect.objectContaining({
          code: 'approval_required',
          dispatched: false,
          approvalReason: 'invalid_or_used_token',
          actionToken: expect.any(String),
        }),
      });
      replacementToken = (error as { details: { actionToken: string } }).details
        .actionToken;
    }
    expect(field.value).toBe('');

    await executor.execute('host_page_fill', {
      ...params,
      actionToken: replacementToken,
    });
    expect(field.value).toBe('correct horse battery staple');
  });

  it('rejects an expired action approval token before dispatch', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<input id="password" type="password" />`;
    const field = document.querySelector<HTMLInputElement>('#password');
    if (!field) {
      throw new Error('Missing expiring approval fixture.');
    }
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();
    const target = snapshot.elements.find((element) => element.tag === 'input');
    const params = {
      pageStateId: snapshot.pageStateId,
      documentRef: target?.documentRef,
      ref: target?.ref,
      value: 'secret',
    };

    try {
      let actionToken = '';
      try {
        await executor.execute('host_page_fill', params);
      } catch (error) {
        actionToken = (error as { details: { actionToken: string } }).details
          .actionToken;
      }
      vi.advanceTimersByTime(60_001);

      await expect(
        executor.execute('host_page_fill', { ...params, actionToken }),
      ).rejects.toMatchObject({
        details: expect.objectContaining({
          code: 'approval_required',
          dispatched: false,
          approvalReason: 'expired_token',
        }),
      });
      expect(field.value).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects an approved action when the page changes before dispatch', async () => {
    document.body.innerHTML = `<input id="password" type="password" />`;
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();
    const target = snapshot.elements.find((element) => element.tag === 'input');
    const params = {
      pageStateId: snapshot.pageStateId,
      documentRef: target?.documentRef,
      ref: target?.ref,
      value: 'secret',
    };
    let actionToken = '';
    try {
      await executor.execute('host_page_fill', params);
    } catch (error) {
      actionToken = (error as { details: { actionToken: string } }).details
        .actionToken;
    }

    document.body.append(document.createElement('section'));
    await Promise.resolve();

    await expect(
      executor.execute('host_page_fill', { ...params, actionToken }),
    ).rejects.toMatchObject({
      details: expect.objectContaining({
        code: 'stale_page_state',
        dispatched: false,
      }),
    });
    expect(document.querySelector<HTMLInputElement>('#password')?.value).toBe(
      '',
    );
  });

  it('requires approval before interacting with a file input', async () => {
    document.body.innerHTML = `<input id="upload" type="file" />`;
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();
    const target = snapshot.elements.find((element) => element.tag === 'input');

    await expect(
      executor.execute('host_page_fill', {
        pageStateId: snapshot.pageStateId,
        documentRef: target?.documentRef,
        ref: target?.ref,
        value: '/tmp/document.pdf',
      }),
    ).rejects.toMatchObject({
      details: expect.objectContaining({
        code: 'approval_required',
        dispatched: false,
        risks: ['file_input'],
      }),
    });
  });

  it('requires approval before activating a form submit control', async () => {
    document.body.innerHTML = `
      <input id="before" />
      <form><button id="submit" type="submit">Submit</button></form>
    `;
    const before = document.getElementById('before');
    const button = document.getElementById('submit');
    if (!(before instanceof HTMLInputElement) || !button) {
      throw new Error('Missing submit approval fixture.');
    }
    before.focus();
    mockRect(button, createDomRect(10, 20, 80, 30));
    const restoreElementsFromPoint = mockElementsFromPoint([button]);
    const click = vi.fn((event: Event) => event.preventDefault());
    button.addEventListener('click', click);
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();
    const target = snapshot.elements.find(
      (element) => element.tag === 'button',
    );

    try {
      await expect(
        executor.execute('host_page_click', {
          pageStateId: snapshot.pageStateId,
          documentRef: target?.documentRef,
          ref: target?.ref,
        }),
      ).rejects.toMatchObject({
        details: expect.objectContaining({
          code: 'approval_required',
          actionToken: expect.any(String),
          risks: ['form_submit'],
        }),
      });
      expect(click).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(before);
    } finally {
      restoreElementsFromPoint();
    }
  });

  it.each([
    {
      label: 'download link',
      attributes: 'href="/export.csv" download',
      risk: 'download',
    },
  ])(
    'requires approval before activating a $label',
    async ({ attributes, risk }) => {
      document.body.innerHTML = `<a id="target" ${attributes}>Open</a>`;
      const anchor = document.getElementById('target');
      if (!anchor) {
        throw new Error('Missing policy-gated link fixture.');
      }
      mockRect(anchor, createDomRect(10, 20, 80, 30));
      const restoreElementsFromPoint = mockElementsFromPoint([anchor]);
      const click = vi.fn((event: Event) => event.preventDefault());
      anchor.addEventListener('click', click);
      const executor = new HostPageAutomationExecutor();
      const snapshot = executor.snapshot();
      const target = snapshot.elements.find((element) => element.tag === 'a');

      try {
        await expect(
          executor.execute('host_page_click', {
            pageStateId: snapshot.pageStateId,
            documentRef: target?.documentRef,
            ref: target?.ref,
          }),
        ).rejects.toMatchObject({
          details: expect.objectContaining({
            code: 'approval_required',
            dispatched: false,
            risks: [risk],
          }),
        });
        expect(click).not.toHaveBeenCalled();
      } finally {
        restoreElementsFromPoint();
      }
    },
  );

  it('allows activating a cross-origin link without approval', async () => {
    document.body.innerHTML =
      '<a id="target" href="https://other.example/path">Open</a>';
    const anchor = document.getElementById('target');
    if (!anchor) {
      throw new Error('Missing cross-origin link fixture.');
    }
    mockRect(anchor, createDomRect(10, 20, 80, 30));
    const restoreElementsFromPoint = mockElementsFromPoint([anchor]);
    const click = vi.fn((event: Event) => event.preventDefault());
    anchor.addEventListener('click', click);
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();
    const target = snapshot.elements.find((element) => element.tag === 'a');

    try {
      await expect(
        executor.execute('host_page_click', {
          pageStateId: snapshot.pageStateId,
          documentRef: target?.documentRef,
          ref: target?.ref,
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          dispatched: true,
          clicked: expect.objectContaining({ tag: 'a' }),
        }),
      );
      expect(click).toHaveBeenCalledOnce();
    } finally {
      restoreElementsFromPoint();
    }
  });

  it('cannot bypass submit approval with a keyboard activation', async () => {
    document.body.innerHTML = `
      <form><button id="submit" type="submit">Submit</button></form>
    `;
    const button = document.getElementById('submit');
    if (!button) {
      throw new Error('Missing keyboard submit fixture.');
    }
    const keydown = vi.fn();
    button.addEventListener('keydown', keydown);
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();
    const target = snapshot.elements.find(
      (element) => element.tag === 'button',
    );

    await expect(
      executor.execute('host_page_press', {
        pageStateId: snapshot.pageStateId,
        documentRef: target?.documentRef,
        ref: target?.ref,
        key: 'Enter',
      }),
    ).rejects.toMatchObject({
      details: expect.objectContaining({
        code: 'approval_required',
        dispatched: false,
        risks: ['form_submit'],
      }),
    });
    expect(keydown).not.toHaveBeenCalled();
  });

  it('returns an unverified action outcome and invalidates state after dispatch', async () => {
    document.body.innerHTML = `<button id="save">Save</button>`;
    const buttonElement = document.getElementById('save');
    if (!buttonElement) {
      throw new Error('Missing button element.');
    }
    mockRect(buttonElement, createDomRect(10, 20, 80, 30));
    const restoreElementFromPoint = mockElementFromPoint(buttonElement);
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();
    const button = snapshot.elements[0];

    try {
      const result = await executor.execute('host_page_click', {
        pageStateId: snapshot.pageStateId,
        documentRef: button?.documentRef,
        ref: button?.ref,
      });

      expect(result).toMatchObject({
        dispatched: true,
        outcome: 'executed_unverified',
        requiresFreshSnapshot: true,
        invalidatedPageStateId: snapshot.pageStateId,
        resolution: {
          strategy: 'ref',
          pageStateId: snapshot.pageStateId,
          resolved: expect.objectContaining({
            documentRef: button?.documentRef,
            ref: button?.ref,
            name: 'Save',
          }),
        },
      });
      await expect(
        executor.execute('host_page_click', {
          pageStateId: snapshot.pageStateId,
          documentRef: button?.documentRef,
          ref: button?.ref,
        }),
      ).rejects.toMatchObject({
        details: expect.objectContaining({ code: 'stale_page_state' }),
      });
    } finally {
      restoreElementFromPoint();
    }
  });

  it('polls fresh DOM state until an action postcondition is verified', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <button id="save">Save</button>
      <input data-testid="status" value="pending" />
    `;
    const buttonElement = document.getElementById('save');
    const status = document.querySelector<HTMLInputElement>(
      '[data-testid="status"]',
    );
    if (!buttonElement || !status) {
      throw new Error('Missing postcondition fixture.');
    }
    mockRect(buttonElement, createDomRect(10, 20, 80, 30));
    const restoreElementFromPoint = mockElementFromPoint(buttonElement);
    buttonElement.addEventListener('click', () => {
      setTimeout(() => {
        status.value = 'saved';
      }, 50);
    });
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();
    const button = snapshot.elements.find(
      (element) => element.tag === 'button',
    );
    const documentRef = snapshot.documents[0]?.documentRef;

    try {
      const resultPromise = executor.execute('host_page_click', {
        pageStateId: snapshot.pageStateId,
        documentRef,
        ref: button?.ref,
        expectation: {
          type: 'field_contains',
          target: {
            documentScope: 'same_document',
            documentRef,
            kind: 'test_id',
            testId: 'status',
          },
          value: 'saved',
        },
      });
      await vi.advanceTimersByTimeAsync(100);

      await expect(resultPromise).resolves.toMatchObject({
        dispatched: true,
        outcome: 'verified',
        requiresFreshSnapshot: true,
        verification: {
          status: 'passed',
          actual: 'saved',
        },
      });
    } finally {
      restoreElementFromPoint();
      vi.useRealTimers();
    }
  });

  it('returns verification_failed with the last observed value after postcondition timeout', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <button id="save">Save</button>
      <input data-testid="status" value="pending" />
    `;
    const buttonElement = document.getElementById('save');
    if (!buttonElement) {
      throw new Error('Missing timeout postcondition fixture.');
    }
    mockRect(buttonElement, createDomRect(10, 20, 80, 30));
    const restoreElementFromPoint = mockElementFromPoint(buttonElement);
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();
    const button = snapshot.elements.find(
      (element) => element.tag === 'button',
    );
    const documentRef = snapshot.documents[0]?.documentRef;

    try {
      const resultPromise = executor.execute('host_page_click', {
        pageStateId: snapshot.pageStateId,
        documentRef,
        ref: button?.ref,
        expectation: {
          type: 'field_contains',
          target: {
            documentScope: 'same_document',
            documentRef,
            kind: 'test_id',
            testId: 'status',
          },
          value: 'saved',
        },
      });
      await vi.advanceTimersByTimeAsync(10_100);

      await expect(resultPromise).resolves.toMatchObject({
        dispatched: true,
        outcome: 'verification_failed',
        verification: {
          status: 'timed_out',
          actual: 'pending',
        },
      });
    } finally {
      restoreElementFromPoint();
      vi.useRealTimers();
    }
  });

  it('fails a postcondition immediately when its observation target is ambiguous', async () => {
    document.body.innerHTML = `
      <button id="save">Save</button>
      <input data-testid="status" value="first" />
      <input data-testid="status" value="second" />
    `;
    const buttonElement = document.getElementById('save');
    if (!buttonElement) {
      throw new Error('Missing ambiguous postcondition fixture.');
    }
    mockRect(buttonElement, createDomRect(10, 20, 80, 30));
    const restoreElementFromPoint = mockElementFromPoint(buttonElement);
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();
    const button = snapshot.elements.find(
      (element) => element.tag === 'button',
    );
    const documentRef = snapshot.documents[0]?.documentRef;

    try {
      await expect(
        executor.execute('host_page_click', {
          pageStateId: snapshot.pageStateId,
          documentRef,
          ref: button?.ref,
          expectation: {
            type: 'field_contains',
            target: {
              documentScope: 'same_document',
              documentRef,
              kind: 'test_id',
              testId: 'status',
            },
            value: 'first',
          },
        }),
      ).resolves.toMatchObject({
        dispatched: true,
        outcome: 'verification_failed',
        verification: {
          status: 'failed',
          actual: null,
        },
      });
    } finally {
      restoreElementFromPoint();
    }
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
    const snapshot = executor.snapshot();
    const button = snapshot.elements[0];

    try {
      await executor.execute('host_page_click', {
        pageStateId: snapshot.pageStateId,
        documentRef: button?.documentRef,
        ref: button?.ref,
      });
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
    const snapshot = executor.snapshot();
    const button = snapshot.elements[0];

    try {
      const result = await executor.execute('host_page_click', {
        pageStateId: snapshot.pageStateId,
        documentRef: button?.documentRef,
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
    const snapshot = executor.snapshot();
    const button = snapshot.elements[0];

    try {
      await executor.execute('host_page_click', {
        pageStateId: snapshot.pageStateId,
        documentRef: button?.documentRef,
        ref: button?.ref,
      });
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

  it('fails closed when an exact semantic target is ambiguous', async () => {
    document.body.innerHTML = `
      <button>Confirm</button>
      <button>Confirm</button>
    `;
    const clicks = vi.fn();
    document.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', clicks);
    });
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();

    await expect(
      executor.execute('host_page_click', {
        pageStateId: snapshot.pageStateId,
        documentRef: snapshot.documents[0]?.documentRef,
        role: 'button',
        name: 'Confirm',
      }),
    ).rejects.toMatchObject({
      details: expect.objectContaining({
        code: 'ambiguous_target',
        resolution: expect.objectContaining({
          strategy: 'semantic_exact',
          candidates: expect.arrayContaining([
            expect.objectContaining({ name: 'Confirm' }),
          ]),
        }),
      }),
    });
    expect(clicks).not.toHaveBeenCalled();
  });

  it('omits weak selectors and rejects unsafe or non-unique selectors', async () => {
    document.body.innerHTML = `
      <button class="save">Save A</button>
      <button class="save">Save B</button>
    `;
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();
    const scope = {
      pageStateId: snapshot.pageStateId,
      documentRef: snapshot.documents[0]?.documentRef,
    };

    expect(snapshot.elements.map((element) => element.selector)).toEqual([
      undefined,
      undefined,
    ]);
    await expect(
      executor.execute('host_page_click', { ...scope, selector: 'button' }),
    ).rejects.toMatchObject({
      details: expect.objectContaining({ code: 'unsafe_selector' }),
    });
    await expect(
      executor.execute('host_page_click', {
        ...scope,
        selector: 'button.save',
      }),
    ).rejects.toMatchObject({
      details: expect.objectContaining({
        code: 'non_unique_selector',
        resolution: expect.objectContaining({
          candidates: expect.arrayContaining([
            expect.objectContaining({ name: 'Save A' }),
            expect.objectContaining({ name: 'Save B' }),
          ]),
        }),
      }),
    });
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
      targetingVersion: 2,
      strictRefs: true,
      strictCoordinates: true,
      freshState: true,
      postconditions: true,
      policyGate: true,
      actionTrace: true,
    });
    expect(snapshot.pageStateId).toEqual(expect.any(String));
    expect(snapshot.documents).toEqual([
      expect.objectContaining({
        documentRef: expect.any(String),
        sameOrigin: true,
      }),
    ]);
    expect(snapshot.page?.readyState).toBe(document.readyState);
    expect(snapshot.viewport.devicePixelRatio).toBe(window.devicePixelRatio);
    expect(button).toMatchObject({
      documentRef: snapshot.documents?.[0]?.documentRef,
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
        preview: expect.arrayContaining(['這款孔眼上衣採用 100% 優質棉製成。']),
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
    const snapshot = executor.snapshot();

    try {
      await executor.execute('host_page_click', {
        pageStateId: snapshot.pageStateId,
        documentRef: snapshot.documents[0]?.documentRef,
        selector: '#change',
      });
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

  it('rejects ambiguous coordinate targets before pointer dispatch', async () => {
    document.body.innerHTML = `
      <button id="top">Execute</button>
      <button id="bottom">Execute</button>
    `;
    const top = document.getElementById('top');
    const bottom = document.getElementById('bottom');
    if (!top || !bottom) {
      throw new Error('Missing coordinate ambiguity fixture.');
    }
    mockRect(top, createDomRect(10, 10, 100, 30));
    mockRect(bottom, createDomRect(10, 70, 100, 30));
    const restoreElementsFromPoint = mockElementsFromPointBy((_x, y) =>
      y < 50 ? [top] : [bottom],
    );
    const click = vi.fn();
    top.addEventListener('click', click);
    bottom.addEventListener('click', click);
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();

    try {
      await expect(
        executor.execute('host_page_pointer', {
          pageStateId: snapshot.pageStateId,
          documentRef: snapshot.documents[0]?.documentRef,
          action: 'click',
          x: 50,
          y: 25,
          coordinateSpace: 'viewport-css-px',
          targetText: 'Execute',
        }),
      ).rejects.toMatchObject({
        details: expect.objectContaining({
          code: 'coordinate_target_ambiguous',
          dispatched: false,
        }),
      });
      expect(click).not.toHaveBeenCalled();
    } finally {
      restoreElementsFromPoint();
    }
  });

  it('revalidates a coordinate target after the click effect before dispatch', async () => {
    document.body.innerHTML = `
      <button id="target">Execute</button>
      <div id="overlay">Loading overlay</div>
    `;
    const target = document.getElementById('target');
    const overlay = document.getElementById('overlay');
    if (!target || !overlay) {
      throw new Error('Missing coordinate revalidation fixture.');
    }
    mockRect(target, createDomRect(10, 10, 100, 30));
    mockRect(overlay, createDomRect(0, 0, 200, 100));
    let effectCompleted = false;
    const restoreElementsFromPoint = mockElementsFromPointBy(() =>
      effectCompleted ? [overlay, target] : [target],
    );
    const click = vi.fn();
    target.addEventListener('click', click);
    const executor = new HostPageAutomationExecutor({
      showVisualEffect: () => {
        effectCompleted = true;
      },
    });
    const snapshot = executor.snapshot();

    try {
      await expect(
        executor.execute('host_page_pointer', {
          pageStateId: snapshot.pageStateId,
          documentRef: snapshot.documents[0]?.documentRef,
          action: 'click',
          x: 50,
          y: 25,
          coordinateSpace: 'viewport-css-px',
          targetText: 'Execute',
        }),
      ).rejects.toMatchObject({
        details: expect.objectContaining({
          code: 'coordinate_target_mismatch',
          dispatched: false,
        }),
      });
      expect(click).not.toHaveBeenCalled();
    } finally {
      restoreElementsFromPoint();
    }
  });

  it('cannot bypass submit approval with a coordinate pointer click', async () => {
    document.body.innerHTML = `
      <form><button id="submit" type="submit">Submit</button></form>
    `;
    const button = document.getElementById('submit');
    if (!button) {
      throw new Error('Missing pointer submit fixture.');
    }
    mockRect(button, createDomRect(10, 20, 80, 30));
    const restoreElementsFromPoint = mockElementsFromPoint([button]);
    const click = vi.fn((event: Event) => event.preventDefault());
    button.addEventListener('click', click);
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();

    try {
      await expect(
        executor.execute('host_page_pointer', {
          pageStateId: snapshot.pageStateId,
          documentRef: snapshot.documents[0]?.documentRef,
          action: 'click',
          x: 50,
          y: 35,
          coordinateSpace: 'viewport-css-px',
          targetText: 'Submit',
        }),
      ).rejects.toMatchObject({
        details: expect.objectContaining({
          code: 'approval_required',
          dispatched: false,
          risks: ['form_submit'],
        }),
      });
      expect(click).not.toHaveBeenCalled();
    } finally {
      restoreElementsFromPoint();
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

  it('scopes strict targets to one same-origin document', async () => {
    document.body.innerHTML = `
      <input data-testid="shared-field" value="top" />
      <iframe></iframe>
    `;
    const frameDocument = document.querySelector('iframe')?.contentDocument;
    if (!frameDocument) {
      throw new Error('Missing same-origin frame document.');
    }
    frameDocument.body.innerHTML =
      '<input data-testid="shared-field" value="frame" />';
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();
    const frameInput = snapshot.elements.find(
      (element) =>
        element.testId === 'shared-field' &&
        element.documentRef !== snapshot.documents[0]?.documentRef,
    );

    expect(snapshot.documents).toHaveLength(2);
    expect(frameInput?.documentRef).toBe(snapshot.documents[1]?.documentRef);
    await executor.execute('host_page_fill', {
      pageStateId: snapshot.pageStateId,
      documentRef: frameInput?.documentRef,
      testId: 'shared-field',
      value: 'updated',
    });

    expect(
      frameDocument.querySelector<HTMLInputElement>(
        '[data-testid="shared-field"]',
      )?.value,
    ).toBe('updated');
    expect(
      document.querySelector<HTMLInputElement>('[data-testid="shared-field"]')
        ?.value,
    ).toBe('top');
  });

  it('uses top viewport coordinates for pointer clicks in same-origin documents', async () => {
    document.body.innerHTML = '<iframe></iframe>';
    const frame = document.querySelector('iframe');
    const frameDocument = frame?.contentDocument;
    if (!frame || !frameDocument) {
      throw new Error('Missing same-origin coordinate frame fixture.');
    }
    frameDocument.body.innerHTML = '<button id="execute">Execute</button>';
    const button = frameDocument.getElementById('execute');
    if (!button) {
      throw new Error('Missing same-origin coordinate target.');
    }
    mockRect(frame, createDomRect(300, 400, 500, 300));
    mockRect(button, createDomRect(20, 30, 100, 40));
    const elementsFromPoint = vi.fn((x: number, y: number) =>
      x === 70 && y === 50 ? [button] : [],
    );
    Object.defineProperty(frameDocument, 'elementsFromPoint', {
      configurable: true,
      value: elementsFromPoint,
    });
    const mousedown = vi.fn();
    const click = vi.fn();
    button.addEventListener('mousedown', mousedown);
    button.addEventListener('click', click);
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();
    const frameDocumentRef = snapshot.documents.find(
      (entry) => entry.parentDocumentRef,
    )?.documentRef;

    const result = await executor.execute('host_page_pointer', {
      pageStateId: snapshot.pageStateId,
      documentRef: frameDocumentRef,
      action: 'click',
      x: 370,
      y: 450,
      coordinateSpace: 'viewport-css-px',
      targetText: 'Execute',
    });

    expect(result).toMatchObject({
      pointer: 'click',
      point: { x: 370, y: 450 },
      targetTextMatched: true,
    });
    expect(elementsFromPoint).toHaveBeenCalledWith(70, 50);
    expect(mousedown).toHaveBeenCalledWith(
      expect.objectContaining({ clientX: 70, clientY: 50 }),
    );
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('rejects coordinate targeting of an inaccessible frame element', async () => {
    document.body.innerHTML =
      '<iframe id="payment-frame" role="button" aria-label="Payment"></iframe>';
    const frame = document.getElementById('payment-frame');
    if (!(frame instanceof HTMLIFrameElement)) {
      throw new Error('Missing inaccessible frame fixture.');
    }
    Object.defineProperty(frame, 'contentDocument', {
      configurable: true,
      get: () => null,
    });
    mockRect(frame, createDomRect(20, 30, 300, 200));
    const restoreElementsFromPoint = mockElementsFromPoint([frame]);
    const click = vi.fn();
    frame.addEventListener('click', click);
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();

    try {
      await expect(
        executor.execute('host_page_pointer', {
          pageStateId: snapshot.pageStateId,
          documentRef: snapshot.documents[0]?.documentRef,
          action: 'click',
          x: 100,
          y: 100,
          coordinateSpace: 'viewport-css-px',
          targetText: 'Payment',
          targetRole: 'button',
        }),
      ).rejects.toMatchObject({
        details: expect.objectContaining({
          code: 'unsupported_target_scope',
          dispatched: false,
        }),
      });
      expect(click).not.toHaveBeenCalled();
    } finally {
      restoreElementsFromPoint();
    }
  });

  it('rejects non-http navigation URLs', async () => {
    const executor = new HostPageAutomationExecutor();

    await expect(
      executor.execute('host_page_navigate', { url: 'chrome://extensions' }),
    ).rejects.toThrow('HTTP(S)');
  });

  it('allows cross-origin navigation without approval', async () => {
    const executor = new HostPageAutomationExecutor();
    const snapshot = executor.snapshot();
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      await expect(
        executor.execute('host_page_navigate', {
          pageStateId: snapshot.pageStateId,
          documentRef: snapshot.documents[0]?.documentRef,
          url: 'https://other.example/path',
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          dispatched: true,
          navigated: 'https://other.example/path',
        }),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it('fails writes when automation is disabled', async () => {
    document.body.innerHTML = `<button>Save</button>`;
    const executor = new HostPageAutomationExecutor({ enabled: false });

    await expect(executor.execute('host_page_snapshot')).rejects.toThrow(
      'disabled',
    );
  });
});
