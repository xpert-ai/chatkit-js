import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkbenchLoadingIndicator } from './WorkbenchLoadingIndicator';

vi.mock('../../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('session loading feedback', () => {
  it('never flashes a loading indicator for a quick session switch', () => {
    const { rerender } = render(<WorkbenchLoadingIndicator pending />);
    act(() => vi.advanceTimersByTime(300));
    expect(screen.queryByRole('status')).toBeNull();
    rerender(<WorkbenchLoadingIndicator pending={false} />);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole('status')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('announces slow initialization without a full-screen cover, and clears immediately when ready', () => {
    const { rerender } = render(<WorkbenchLoadingIndicator pending />);
    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByRole('status')).toHaveClass(
      'h-0.5',
      'pointer-events-none',
    );
    expect(screen.getByText('message.loading')).toHaveClass('sr-only');
    rerender(<WorkbenchLoadingIndicator pending={false} />);
    expect(screen.queryByRole('status')).toBeNull();
    rerender(<WorkbenchLoadingIndicator pending />);
    expect(screen.queryByRole('status')).toBeNull();
    act(() => vi.advanceTimersByTime(399));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('cancels delayed feedback when the session unmounts', () => {
    const { unmount } = render(<WorkbenchLoadingIndicator pending />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
