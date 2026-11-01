import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../../providers/Theme';
import type { SharingClient } from '../../sharing/share-client';
import { ChatHeaderActions } from './ChatHeaderActions';

const translate = (key: string) => key;
vi.mock('../../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({ t: translate }),
}));

beforeEach(() => {
  // Tooltip placement is not measured in jsdom; keep its observer lifecycle intact.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function createShareTarget(disabled = false) {
  const conversations = {
    previewShare: vi.fn().mockResolvedValue({
      snapshot: { title: 'Example', messages: [] },
      digest: 'preview',
      publicSharingEnabled: true,
    }),
    listShares: vi.fn().mockResolvedValue([]),
    createShare: vi.fn(),
    revokeShare: vi.fn(),
  };
  return {
    client: { conversations } as unknown as SharingClient,
    conversationId: 'conversation',
    threadId: 'branch',
    disabled,
  };
}

describe('Chat header sharing', () => {
  it('opens sharing directly and returns keyboard focus without creating a link', async () => {
    const share = createShareTarget();
    render(
      <ThemeProvider>
        <ChatHeaderActions share={share} />
      </ThemeProvider>,
    );
    expect(
      screen.queryByRole('button', { name: 'chat.moreActions' }),
    ).toBeNull();
    const trigger = screen.getByRole('button', { name: 'sharing.action' });
    act(() => trigger.focus());
    fireEvent.click(trigger);
    await screen.findByRole('dialog');
    await waitFor(() =>
      expect(share.client.conversations.previewShare).toHaveBeenCalledWith(
        'conversation',
        'branch',
      ),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'composer.resources.close' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(share.client.conversations.createShare).not.toHaveBeenCalled();
  });

  it('keeps sharing disabled until the conversation is ready', () => {
    const share = createShareTarget(true);
    render(
      <ThemeProvider>
        <ChatHeaderActions share={share} />
      </ThemeProvider>,
    );
    const trigger = screen.getByRole('button', { name: 'sharing.action' });
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(share.client.conversations.previewShare).not.toHaveBeenCalled();
  });

  it('explains unavailable sharing without requesting a preview or creating a link', async () => {
    const share = {
      ...createShareTarget(),
      disabledReason: 'Project conversations cannot be shared.',
    };
    render(
      <ThemeProvider>
        <ChatHeaderActions share={share} />
      </ThemeProvider>,
    );
    const trigger = screen.getByRole('button', { name: 'sharing.action' });
    expect(trigger).toBeVisible();
    expect(trigger).toBeDisabled();
    fireEvent.focus(screen.getByLabelText(share.disabledReason));
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      share.disabledReason,
    );
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(share.client.conversations.previewShare).not.toHaveBeenCalled();
    expect(share.client.conversations.createShare).not.toHaveBeenCalled();
  });
});
