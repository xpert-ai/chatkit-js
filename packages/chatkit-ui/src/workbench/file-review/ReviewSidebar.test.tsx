import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../../i18n';
import { ReviewSidebar, clampReviewSidebarWidth } from './ReviewSidebar';

function Sidebar({ containerWidth = 1100 }: { containerWidth?: number }) {
  const [preferred, setPreferred] = React.useState(260);
  return (
    <ReviewSidebar
      containerWidth={containerWidth}
      width={clampReviewSidebarWidth(preferred, containerWidth)}
      onWidthChange={setPreferred}
    >
      Files
    </ReviewSidebar>
  );
}

describe('review sidebar resizing', () => {
  beforeEach(() => {
    initI18n();
    vi.stubGlobal(
      'PointerEvent',
      class extends MouseEvent {
        readonly pointerId: number;
        constructor(type: string, init: PointerEventInit = {}) {
          super(type, init);
          this.pointerId = init.pointerId ?? 1;
        }
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('drags the right panel, ignores other pointers, and respects both bounds', () => {
    render(<Sidebar />);
    const divider = screen.getByRole('separator');
    fireEvent.pointerDown(divider, { button: 0, clientX: 840, pointerId: 1 });
    fireEvent.pointerMove(divider, { clientX: 760, pointerId: 2 });
    expect(divider).toHaveAttribute('aria-valuenow', '260');
    fireEvent.pointerMove(divider, { clientX: 760, pointerId: 1 });
    expect(divider).toHaveAttribute('aria-valuenow', '340');
    expect(divider.parentElement).toHaveStyle({ width: '340px' });
    fireEvent.lostPointerCapture(divider, { pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: -100, pointerId: 1 });
    expect(divider).toHaveAttribute('aria-valuenow', '520');
    fireEvent.pointerMove(divider, { clientX: 1400, pointerId: 1 });
    expect(divider).toHaveAttribute('aria-valuenow', '200');
    fireEvent.pointerUp(divider, { pointerId: 1 });
    fireEvent.pointerMove(divider, { clientX: 800, pointerId: 1 });
    expect(divider).toHaveAttribute('aria-valuenow', '200');
    expect(divider).not.toHaveAttribute('data-resizing');
  });

  it.each(['pointercancel', 'blur', 'Escape'] as const)(
    'restores width when interrupted by %s',
    (reason) => {
      render(<Sidebar />);
      const divider = screen.getByRole('separator');
      fireEvent.pointerDown(divider, { button: 0, clientX: 840, pointerId: 1 });
      fireEvent.pointerMove(divider, { clientX: 760, pointerId: 1 });
      if (reason === 'pointercancel')
        fireEvent.pointerCancel(divider, { pointerId: 1 });
      else if (reason === 'blur') fireEvent.blur(window);
      else fireEvent.keyDown(window, { key: 'Escape' });
      expect(divider).toHaveAttribute('aria-valuenow', '260');
      expect(divider).not.toHaveAttribute('data-resizing');
    },
  );

  it('supports keyboard resizing and clamps to a shrinking viewport without losing the preference', () => {
    const { rerender } = render(<Sidebar />);
    const divider = screen.getByRole('separator');
    fireEvent.keyDown(divider, { key: 'ArrowLeft' });
    expect(divider).toHaveAttribute('aria-valuenow', '276');
    fireEvent.keyDown(divider, { key: 'ArrowRight' });
    expect(divider).toHaveAttribute('aria-valuenow', '260');
    fireEvent.keyDown(divider, { key: 'End' });
    expect(divider).toHaveAttribute('aria-valuenow', '520');
    rerender(<Sidebar containerWidth={620} />);
    expect(divider).toHaveAttribute('aria-valuemax', '300');
    expect(divider).toHaveAttribute('aria-valuenow', '300');
    rerender(<Sidebar containerWidth={320} />);
    expect(divider).toHaveAttribute('aria-valuenow', '288');
    expect(divider.parentElement).toHaveClass('review-sidebar-overlay');
    rerender(<Sidebar />);
    expect(divider).toHaveAttribute('aria-valuenow', '520');
    fireEvent.keyDown(divider, { key: 'Home' });
    expect(divider).toHaveAttribute('aria-valuenow', '200');
    fireEvent.doubleClick(divider);
    expect(divider).toHaveAttribute('aria-valuenow', '260');
  });

  it('removes cancellation listeners when unmounted during a drag', () => {
    const onWidthChange = vi.fn();
    const { unmount } = render(
      <ReviewSidebar
        containerWidth={1100}
        width={260}
        onWidthChange={onWidthChange}
      >
        Files
      </ReviewSidebar>,
    );
    fireEvent.pointerDown(screen.getByRole('separator'), {
      button: 0,
      clientX: 840,
    });
    unmount();
    fireEvent.pointerMove(window, { clientX: 700 });
    fireEvent.pointerUp(window);
    fireEvent.blur(window);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onWidthChange).not.toHaveBeenCalled();
  });
});
