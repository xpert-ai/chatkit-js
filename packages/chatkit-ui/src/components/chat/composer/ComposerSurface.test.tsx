import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ComposerSurface } from './ComposerSurface';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
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
