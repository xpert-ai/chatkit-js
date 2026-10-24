import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFloatingChatPosition } from './useFloatingChatPosition';

afterEach(() => vi.unstubAllGlobals());
describe('floating chat positioning', () => {
  it('clamps keyboard movement and repositions after the available area shrinks', () => {
    let resize!: () => void;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    function Fixture() {
      const position = useFloatingChatPosition(true);
      return (
        <div ref={position.boundsRef} data-testid="bounds">
          <div
            ref={position.surfaceRef}
            data-testid="surface"
            style={position.style}
          >
            <button {...position.handleProps}>Move</button>
          </div>
        </div>
      );
    }
    render(<Fixture />);
    const bounds = screen.getByTestId('bounds');
    const surface = screen.getByTestId('surface');
    Object.defineProperties(bounds, {
      clientWidth: { value: 1200, configurable: true },
      clientHeight: { value: 800, configurable: true },
    });
    Object.defineProperties(surface, {
      offsetWidth: { value: 640, configurable: true },
      offsetHeight: { value: 160, configurable: true },
    });
    act(() => resize());
    expect(surface.style.left).toBe('280px');
    expect(surface.style.top).toBe('624px');
    for (let i = 0; i < 50; i++)
      fireEvent.keyDown(screen.getByText('Move'), { key: 'ArrowRight' });
    expect(surface.style.left).toBe('544px');
    Object.defineProperty(bounds, 'clientWidth', { value: 720 });
    act(() => resize());
    expect(surface.style.left).toBe('64px');
  });

  it('drags the launcher without activating it, preserves its position, and still allows clicks', () => {
    vi.stubGlobal(
      'PointerEvent',
      class extends MouseEvent {
        pointerId: number;
        constructor(type: string, init: PointerEventInit = {}) {
          super(type, init);
          this.pointerId = init.pointerId ?? 1;
        }
      },
    );
    let resize = () => {};
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const saved = { current: null as { x: number; y: number } | null };
    const restore = vi.fn();
    function Fixture({ active = true }: { active?: boolean }) {
      const position = useFloatingChatPosition<HTMLButtonElement>(
        active,
        saved,
        'right',
      );
      return (
        <div ref={position.boundsRef} data-testid="bounds">
          <button
            ref={position.surfaceRef}
            style={position.style}
            {...position.handleProps}
            onClick={restore}
          >
            Restore
          </button>
        </div>
      );
    }
    const result = render(<Fixture />);
    const bounds = screen.getByTestId('bounds');
    const launcher = screen.getByText('Restore');
    Object.defineProperties(bounds, {
      clientWidth: { value: 1200, configurable: true },
      clientHeight: { value: 800, configurable: true },
    });
    Object.defineProperties(launcher, {
      offsetWidth: { value: 48 },
      offsetHeight: { value: 48 },
      setPointerCapture: { value: vi.fn() },
      hasPointerCapture: { value: () => true },
      releasePointerCapture: { value: vi.fn() },
      getBoundingClientRect: {
        value: () => ({
          left: parseFloat(launcher.style.left),
          top: parseFloat(launcher.style.top),
        }),
      },
    });
    act(() => resize());
    expect(launcher.style.left).toBe('1136px');
    expect(launcher.style.top).toBe('736px');
    fireEvent.pointerDown(launcher, {
      pointerId: 1,
      button: 0,
      clientX: 1160,
      clientY: 760,
    });
    fireEvent.pointerMove(launcher, {
      pointerId: 1,
      clientX: 960,
      clientY: 660,
    });
    fireEvent.pointerUp(launcher, { pointerId: 1 });
    fireEvent.click(launcher, { detail: 1 });
    expect(restore).not.toHaveBeenCalled();
    expect(launcher.style.left).toBe('936px');
    expect(launcher.style.top).toBe('636px');
    result.rerender(<Fixture active={false} />);
    result.rerender(<Fixture />);
    expect(launcher.style.left).toBe('936px');
    expect(launcher.style.top).toBe('636px');

    // Small pointer jitter remains a click; keyboard activation also works.
    fireEvent.pointerDown(launcher, {
      pointerId: 1,
      button: 0,
      clientX: 960,
      clientY: 660,
    });
    fireEvent.pointerMove(launcher, {
      pointerId: 1,
      clientX: 961,
      clientY: 661,
    });
    fireEvent.pointerUp(launcher, { pointerId: 1 });
    fireEvent.click(launcher, { detail: 1 });
    fireEvent.click(launcher, { detail: 0 });
    expect(restore).toHaveBeenCalledTimes(2);
    expect(launcher.style.left).toBe('936px');
    Object.defineProperty(bounds, 'clientWidth', { value: 400 });
    Object.defineProperty(bounds, 'clientHeight', { value: 300 });
    act(() => resize());
    expect(launcher.style.left).toBe('336px');
    expect(launcher.style.top).toBe('236px');
  });
});
