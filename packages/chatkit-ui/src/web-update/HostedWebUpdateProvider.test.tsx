import * as React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { HostedWebUpdateProvider } from './HostedWebUpdateProvider';
import { HostedWebUpdateContext, useWebUpdateLeave } from './context';
import { ThemeProvider } from '../providers/Theme';
import { EditorLifecycle } from '../workbench/editors/editor-lifecycle';
import { readStandaloneRelease, reloadWebUpdate } from './web-update-browser';

vi.mock('../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('./web-update-browser', async (original) => ({
  ...(await original<typeof import('./web-update-browser')>()),
  reloadWebUpdate: vi.fn(),
  readStandaloneRelease: vi.fn(() => ({ buildId: 'A', version: '3' })),
}));
vi.mock('sonner', async (original) => {
  const actual = await original<typeof import('sonner')>();
  return {
    ...actual,
    toast: {
      info: vi.fn(actual.toast.info),
      error: vi.fn(actual.toast.error),
      dismiss: vi.fn(actual.toast.dismiss),
    },
  };
});

function Entry({ editors }: { editors: EditorLifecycle }) {
  const update = React.useContext(HostedWebUpdateContext);
  const prepare = React.useCallback(() => editors.prepare(), [editors]);
  useWebUpdateLeave(prepare);
  return <button onClick={() => update?.openAbout()}>About entry</button>;
}

describe('Standalone update surfaces', () => {
  let fetchRelease = vi.fn();
  let editors: EditorLifecycle;
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(readStandaloneRelease).mockReturnValue({
      buildId: 'A',
      version: '3',
    });
    fetchRelease = vi.fn(async () => ({
      ok: true,
      json: async () => ({ buildId: 'B', version: '3' }),
    }));
    vi.stubGlobal('fetch', fetchRelease);
    editors = new EditorLifecycle();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  const view = (
    theme = { radius: 'sharp' as const, density: 'compact' as const },
  ) =>
    render(
      <ThemeProvider theme={theme}>
        <HostedWebUpdateProvider>
          <Entry editors={editors} />
        </HostedWebUpdateProvider>
      </ThemeProvider>,
    );

  const clickUpdate = (dialog: 'about' | 'updateNow') =>
    fireEvent.click(
      within(
        screen.getByRole('dialog', { name: `webUpdate.${dialog}` }),
      ).getByRole('button', { name: 'webUpdate.updateNow' }),
    );

  it('keeps About updates after notice dismissal and confirms before reloading', async () => {
    view();
    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    const options = vi.mocked(toast.info).mock.calls[0]?.[1];
    expect(options).toMatchObject({ duration: Infinity, closeButton: true });
    expect(document.querySelector('[data-sonner-toaster]')).toHaveAttribute(
      'data-x-position',
      'left',
    );
    expect(document.querySelector('[data-sonner-toaster]')).toHaveAttribute(
      'data-y-position',
      'bottom',
    );
    await act(async () => {
      options?.onDismiss?.({ id: 'update-toast' });
    });
    expect(sessionStorage.getItem('xpert.web-update.dismissed')).toBe('B');
    fireEvent.click(screen.getByText('About entry'));
    await waitFor(() =>
      expect(screen.getByText('webUpdate.available')).toBeInTheDocument(),
    );
    clickUpdate('about');
    expect(reloadWebUpdate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'webUpdate.cancel' }));
    expect(reloadWebUpdate).not.toHaveBeenCalled();
    clickUpdate('about');
    clickUpdate('updateNow');
    await waitFor(() => expect(reloadWebUpdate).toHaveBeenCalledTimes(1));
  });

  it('uses the real editor coordinator and keeps the page when saving fails', async () => {
    const save = vi.fn(async () => {
      throw new Error('save failed');
    });
    editors.register('doc', { tabKey: 'doc', dirty: true, prepare: save });
    view();
    fireEvent.click(screen.getByText('About entry'));
    await waitFor(() =>
      expect(screen.getByText('webUpdate.available')).toBeInTheDocument(),
    );
    clickUpdate('about');
    clickUpdate('updateNow');
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'webUpdate.leaveFailed',
        expect.anything(),
      ),
    );
    expect(save).toHaveBeenCalledTimes(1);
    expect(reloadWebUpdate).not.toHaveBeenCalled();
  });

  it('shows retry after network failure and never claims to be current', async () => {
    fetchRelease.mockRejectedValue(new Error('offline'));
    view();
    fireEvent.click(screen.getByText('About entry'));
    await waitFor(() =>
      expect(screen.getByText('webUpdate.checkFailed')).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', { name: 'webUpdate.retry' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('webUpdate.latest')).not.toBeInTheDocument();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('does not reload when a pending save completes after the app unmounts', async () => {
    let complete: (result: boolean) => void = () => undefined;
    const save = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          complete = resolve;
        }),
    );
    editors.register('doc', { tabKey: 'doc', dirty: true, prepare: save });
    const rendered = view();
    fireEvent.click(screen.getByText('About entry'));
    await waitFor(() =>
      expect(screen.getByText('webUpdate.available')).toBeInTheDocument(),
    );
    clickUpdate('about');
    clickUpdate('updateNow');
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    rendered.unmount();
    await act(async () => complete(true));
    expect(reloadWebUpdate).not.toHaveBeenCalled();
  });

  it('updates portal radius, density and dark mode while About is open', async () => {
    const rendered = view();
    fireEvent.click(screen.getByText('About entry'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.style.getPropertyValue('--chat-panel-radius')).toBe('0px');
    expect(dialog.style.getPropertyValue('--chat-density-scale')).toBe('0.75');
    rendered.rerender(
      <ThemeProvider
        theme={{ radius: 'round', density: 'spacious', colorScheme: 'dark' }}
      >
        <HostedWebUpdateProvider>
          <Entry editors={editors} />
        </HostedWebUpdateProvider>
      </ThemeProvider>,
    );
    expect(dialog.style.getPropertyValue('--chat-panel-radius')).toBe(
      'calc(var(--radius, 0.625rem) + 4px)',
    );
    expect(dialog.style.getPropertyValue('--chat-density-scale')).toBe('1.25');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('does not poll or render an update surface when not opted in', async () => {
    vi.mocked(readStandaloneRelease).mockReturnValue(null);
    view();
    fireEvent.click(screen.getByText('About entry'));
    expect(fetchRelease).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('keeps update recovery available when an application chunk fails to render', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function FailedChunk(): React.ReactNode {
      throw new Error('Chunk unavailable');
    }
    try {
      render(
        <ThemeProvider>
          <HostedWebUpdateProvider>
            <FailedChunk />
          </HostedWebUpdateProvider>
        </ThemeProvider>,
      );
      expect(screen.getByText('webUpdate.loadFailed')).toBeInTheDocument();
      await waitFor(() => expect(toast.info).toHaveBeenCalled());
      fireEvent.click(screen.getByRole('button', { name: 'webUpdate.about' }));
      await waitFor(() =>
        expect(screen.getByText('webUpdate.available')).toBeInTheDocument(),
      );
      clickUpdate('about');
      expect(reloadWebUpdate).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
