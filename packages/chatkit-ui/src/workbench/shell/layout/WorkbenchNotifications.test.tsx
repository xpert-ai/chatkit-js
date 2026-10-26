import * as React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ThemeProvider } from '../../../providers/Theme';
import { WorkbenchNotifications } from './WorkbenchNotifications';

vi.mock('../../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  toast.dismiss();
  vi.useRealTimers();
});

function findToast(title: string) {
  const item = toast
    .getToasts()
    .find((item) => 'title' in item && item.title === title);
  if (!item || !('title' in item)) throw new Error(`Missing toast: ${title}`);
  return item;
}

describe('WorkbenchNotifications', () => {
  it.each([false, true])(
    'preserves new feedback after a queued dismissal (previous notice: %s)',
    async (previousNotice) => {
      vi.useFakeTimers({
        toFake: [
          'setTimeout',
          'clearTimeout',
          'requestAnimationFrame',
          'cancelAnimationFrame',
        ],
      });
      const clear = vi.fn();
      const previous = { level: 'error' as const, message: 'Previous failure' };
      const current = {
        level: 'error' as const,
        message: 'Side chat unavailable',
      };
      const { rerender } = render(
        <WorkbenchNotifications
          notification={previousNotice ? previous : null}
          onClear={clear}
        />,
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      if (previousNotice)
        rerender(
          <WorkbenchNotifications notification={null} onClear={clear} />,
        );
      rerender(
        <WorkbenchNotifications notification={current} onClear={clear} />,
      );
      // Sonner delivers dismissals on the next frame, then removes their DOM nodes.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });
      expect(screen.getByText(current.message)).toBeVisible();
      expect(screen.queryByText(previous.message)).not.toBeInTheDocument();
      expect(clear).not.toHaveBeenCalled();
    },
  );

  it('shows and dismisses feedback in a themed outlet without a panel banner', async () => {
    const clear = vi.fn();
    const notice = {
      level: 'error' as const,
      message: 'Draft is still unsaved',
    };
    const { container, rerender } = render(
      <ThemeProvider
        theme={{ colorScheme: 'light', radius: 'sharp', density: 'compact' }}
      >
        <WorkbenchNotifications notification={notice} onClear={clear} />
      </ThemeProvider>,
    );
    await screen.findByText(notice.message);
    expect(
      container.querySelector('[data-sonner-toaster]')?.getAttribute('style'),
    ).toContain('--chat-panel-radius: 0px');
    expect(
      container.querySelector('[data-sonner-toaster]')?.getAttribute('style'),
    ).toContain('--chat-density-scale: 0.75');
    rerender(
      <ThemeProvider
        theme={{ colorScheme: 'dark', radius: 'round', density: 'spacious' }}
      >
        <WorkbenchNotifications notification={notice} onClear={clear} />
      </ThemeProvider>,
    );
    await waitFor(() =>
      expect(
        container
          .querySelector('[data-sonner-toaster]')
          ?.getAttribute('data-sonner-theme'),
      ).toBe('dark'),
    );
    expect(
      container.querySelector('[data-sonner-toaster]')?.getAttribute('style'),
    ).toContain('--chat-density-scale: 1.25');
    act(() =>
      screen
        .getByRole('button', { name: 'workbench.dismissNotification' })
        .click(),
    );
    expect(clear).toHaveBeenCalledOnce();
  });

  it('isolates multiple workbenches and ignores stale dismissal callbacks', async () => {
    const firstClear = vi.fn(),
      secondClear = vi.fn();
    const first = { level: 'error' as const, message: 'First workbook' };
    const second = { level: 'success' as const, message: 'Second workbook' };
    const { rerender } = render(
      <>
        <WorkbenchNotifications notification={first} onClear={firstClear} />
        <WorkbenchNotifications notification={second} onClear={secondClear} />
      </>,
    );
    await screen.findByText(first.message);
    await screen.findByText(second.message);
    const oldToast = findToast(first.message);
    const otherToast = findToast(second.message);
    expect(oldToast.toasterId).not.toEqual(otherToast.toasterId);
    expect(screen.getAllByText(first.message)).toHaveLength(1);
    expect(screen.getAllByText(second.message)).toHaveLength(1);

    const newer = { level: 'error' as const, message: 'Newer failure' };
    rerender(
      <>
        <WorkbenchNotifications notification={newer} onClear={firstClear} />
        <WorkbenchNotifications notification={second} onClear={secondClear} />
      </>,
    );
    await screen.findByText(newer.message);
    act(() => oldToast.onAutoClose?.(oldToast));
    expect(firstClear).not.toHaveBeenCalled();
    expect(secondClear).not.toHaveBeenCalled();
    const currentToast = findToast(newer.message);
    act(() => currentToast.onAutoClose?.(currentToast));
    expect(firstClear).toHaveBeenCalledOnce();
    expect(secondClear).not.toHaveBeenCalled();
  });
});
