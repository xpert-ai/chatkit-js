import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { ChatComposerFormFrame, ComposerSurface } from './ComposerSurface';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it.each([false, true])(
  'keeps upper panels in the visible stack, outside the input form (compact: %s)',
  (compact) => {
    const onSend = vi.fn((event) => event.preventDefault());
    const onAnswer = vi.fn((event) => event.preventDefault());
    const formRef = createRef<HTMLFormElement>();
    const view = render(
      <ChatComposerFormFrame
        compact={compact}
        formRef={formRef}
        onSubmit={onSend}
        before={
          <form aria-label="Approval" onSubmit={onAnswer}>
            <button type="submit">Confirm</button>
          </form>
        }
        actions={<button type="submit">Send</button>}
        overlay={<button type="button">Scroll to bottom</button>}
      >
        <input aria-label="Message" />
      </ChatComposerFormFrame>,
    );
    const shell = view.container.querySelector(
      '[data-slot="composer-input-shell"]',
    );
    const content = view.container.querySelector(
      '[data-slot="composer-content"]',
    );
    const panel = screen.getByRole('form', { name: 'Approval' });
    const input = screen.getByRole('textbox', { name: 'Message' });
    expect(shell).toHaveAttribute(
      'data-layout',
      compact ? 'compact' : 'stacked',
    );
    expect(shell).toHaveClass('flex-col', 'justify-end');
    expect(content).toContainElement(panel);
    expect(content).toContainElement(input);
    expect(panel.closest('[data-slot="composer-content"]')).toBe(content);
    expect(formRef.current).toBe(input.closest('form'));
    expect(formRef.current).not.toContainElement(panel);
    expect(panel.parentElement?.closest('form')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Scroll to bottom' }).parentElement,
    ).toBe(content);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onAnswer).toHaveBeenCalledOnce();
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledOnce();
  },
);

it('tracks upper-panel resizing without consuming the reserved input height', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  let inputHeight = 150;
  let panelHeight = 100;
  const observers = new Map<Element, () => void>();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      elements = new Set<Element>();
      constructor(readonly callback: () => void) {}
      observe(element: Element) {
        this.elements.add(element);
        observers.set(element, this.callback);
      }
      disconnect() {
        for (const element of this.elements) observers.delete(element);
      }
    },
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      return new DOMRect(
        0,
        0,
        600,
        this.dataset.slot === 'composer-before' ? panelHeight : inputHeight,
      );
    },
  );
  const renderSurface = (compact: boolean, showPanel = true) => (
    <ComposerSurface
      compact={compact}
      paddedBottom={false}
      before={showPanel ? <div role="status">Pending tasks</div> : null}
      actions={null}
    >
      <input />
    </ComposerSurface>
  );
  const view = render(renderSurface(false));
  const shell = view.container.querySelector(
    '[data-slot="composer-input-shell"]',
  );
  const resizePanel = (height: number) => {
    panelHeight = height;
    const panel = view.container.querySelector('[data-slot="composer-before"]');
    if (!panel) throw new Error('Missing upper panels');
    act(() => observers.get(panel)?.());
  };
  expect(shell).toHaveStyle({ minHeight: '250px' });
  inputHeight = 48;
  view.rerender(renderSurface(true));
  expect(shell).toHaveStyle({ minHeight: '250px' });
  // A task list can shrink or an error can appear while reading history.
  resizePanel(40);
  expect(shell).toHaveStyle({ minHeight: '190px' });
  resizePanel(180);
  expect(shell).toHaveStyle({ minHeight: '330px' });
  view.rerender(renderSurface(false));
  inputHeight = 170;
  resizePanel(60);
  expect(shell).toHaveStyle({ minHeight: '210px' });
  act(() => vi.advanceTimersByTime(240));
  expect(shell).toHaveStyle({ minHeight: '230px' });
  view.rerender(renderSurface(true, false));
  expect(shell).toHaveStyle({ minHeight: '170px' });
  view.unmount();
  expect(observers.size).toBe(0);
});

it('measures the expanded footprint when first mounted in compact mode', () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const compact = this.closest('[data-layout="compact"]');
      return new DOMRect(0, 0, 600, compact ? 48 : 150);
    },
  );
  const view = render(
    <ComposerSurface compact paddedBottom={false} actions={null}>
      <input />
    </ComposerSurface>,
  );
  const shell = view.container.querySelector(
    '[data-slot="composer-input-shell"]',
  );
  expect(shell).toHaveAttribute('data-layout', 'compact');
  expect(shell).toHaveStyle({ minHeight: '150px' });
});

it.each([0, 2])(
  'reserves the expanded scroll footprint including %ipx padding until restoration finishes',
  (padding) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let height = 150;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () => new DOMRect(0, 0, 600, height),
    );
    const view = render(
      <ComposerSurface style={{ paddingBottom: padding }} actions={null}>
        <input />
      </ComposerSurface>,
    );
    const shell = view.container.querySelector(
      '[data-slot="composer-input-shell"]',
    );
    expect(shell).toHaveStyle({ minHeight: `${150 + padding}px` });
    height = 48;
    view.rerender(
      <ComposerSurface
        compact
        style={{ paddingBottom: padding }}
        actions={null}
      >
        <input />
      </ComposerSurface>,
    );
    expect(shell).toHaveStyle({ minHeight: `${150 + padding}px` });
    view.rerender(
      <ComposerSurface style={{ paddingBottom: padding }} actions={null}>
        <input />
      </ComposerSurface>,
    );
    expect(shell).toHaveStyle({ minHeight: `${150 + padding}px` });
    height = 170;
    act(() => {
      vi.advanceTimersByTime(240);
    });
    expect(shell).toHaveStyle({ minHeight: `${170 + padding}px` });
  },
);

it('clips the toolbar throughout restoration, including an interrupted transition', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const renderSurface = (compact: boolean) => (
    <ComposerSurface
      compact={compact}
      actions={null}
      footer={<button>Files</button>}
    >
      <input />
    </ComposerSurface>
  );
  const view = render(renderSurface(false));
  const toolbar = view.container.querySelector(
    '[data-slot="composer-context-collapse"]',
  );
  expect(toolbar).not.toHaveAttribute('data-restoring');
  view.rerender(renderSurface(true));
  view.rerender(renderSurface(false));
  expect(toolbar).toHaveAttribute('data-restoring');
  act(() => vi.advanceTimersByTime(120));
  view.rerender(renderSurface(true));
  view.rerender(renderSurface(false));
  act(() => vi.advanceTimersByTime(120));
  expect(toolbar).toHaveAttribute('data-restoring');
  act(() => vi.advanceTimersByTime(120));
  expect(toolbar).not.toHaveAttribute('data-restoring');
  expect(toolbar).not.toHaveAttribute('inert');
});
