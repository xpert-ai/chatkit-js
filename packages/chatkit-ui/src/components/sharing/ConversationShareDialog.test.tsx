import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SharingClient } from './share-client';
import { ThemeProvider } from '../../providers/Theme';
import { ConversationShareDialog } from './ConversationShareDialog';

const translate = (key: string) => key;
vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({ t: translate }),
}));
const preview = {
  snapshot: {
    title: 'Example',
    messages: [
      { role: 'human', text: '<img src="secret" onerror="alert(1)">' },
      { role: 'ai', text: 'Shared answer' },
    ],
  },
  digest: 'a'.repeat(64),
  publicSharingEnabled: true,
};
const share = {
  id: 'share',
  audience: 'organization',
  createdAt: '2026-10-27T00:00:00Z',
  expiresAt: '2026-11-03T00:00:00Z',
  url: 'https://app.example/s/cs_test',
};
const methods = {
  previewShare: vi.fn(),
  listShares: vi.fn(),
  createShare: vi.fn(),
  revokeShare: vi.fn(),
};
const client = { conversations: methods } as unknown as SharingClient;
const clipboard = vi.fn();
const props = {
  client,
  conversationId: 'chat',
  threadId: 'branch',
  open: true,
  onOpenChange: vi.fn(),
};
const wrap = (theme?: React.ComponentProps<typeof ThemeProvider>['theme']) =>
  render(
    <ThemeProvider theme={theme}>
      <ConversationShareDialog {...props} />
    </ThemeProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  methods.previewShare.mockResolvedValue(preview);
  methods.listShares.mockResolvedValue([]);
  methods.createShare.mockResolvedValue(share);
  methods.revokeShare.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: clipboard.mockResolvedValue(undefined) },
  });
});

describe('conversation share dialog', () => {
  it('opens personal share management without passing the delegated session or share token', async () => {
    const managementUrl =
      'https://app.example/settings/account/profile?dialog=shared-links';
    methods.previewShare.mockResolvedValue({ ...preview, managementUrl });
    wrap();
    const link = await screen.findByRole('link', {
      name: 'sharing.manageLinks',
    });
    expect(link).toHaveAttribute('href', managementUrl);
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
  });
  it('reloads and copies exactly the persisted link after unmounting without creating or replacing it', async () => {
    methods.listShares.mockResolvedValue([share]);
    const first = wrap();
    expect(await screen.findByLabelText('sharing.link')).toHaveValue(share.url);
    fireEvent.click(screen.getByText('sharing.copy'));
    await waitFor(() => expect(clipboard).toHaveBeenCalledWith(share.url));
    first.unmount();
    wrap();
    expect(await screen.findByLabelText('sharing.link')).toHaveValue(share.url);
    fireEvent.click(screen.getByText('sharing.copy'));
    await waitFor(() => expect(clipboard).toHaveBeenCalledTimes(2));
    expect(methods.createShare).not.toHaveBeenCalled();
    expect(methods.revokeShare).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('sharing.audience')).toBeNull();
  });
  it('opens settings explicitly before offering replacement and keeps public acknowledgement required', async () => {
    methods.listShares.mockResolvedValue([{ ...share, audience: 'public' }]);
    wrap();
    fireEvent.click(await screen.findByText('sharing.editShare'));
    expect(methods.createShare).not.toHaveBeenCalled();
    expect(screen.getByLabelText('sharing.audience')).toHaveValue('public');
    expect(screen.getByText('sharing.replace')).toBeDisabled();
    fireEvent.click(screen.getByText('sharing.copy'));
    await waitFor(() => expect(clipboard).toHaveBeenCalledWith(share.url));
    expect(methods.createShare).not.toHaveBeenCalled();
  });
  it('does not offer creation when existing-link loading failed', async () => {
    methods.listShares.mockRejectedValue(new Error('offline'));
    wrap();
    await screen.findByRole('alert');
    expect(screen.getByText('sharing.create')).toBeDisabled();
    expect(methods.createShare).not.toHaveBeenCalled();
  });
  it('renders inert text, defaults to organization scope, and copies on the first create click', async () => {
    wrap();
    await screen.findByText('Shared answer');
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByLabelText('sharing.audience')).toHaveValue(
      'organization',
    );
    fireEvent.click(screen.getByText('sharing.create'));
    await waitFor(() => expect(clipboard).toHaveBeenCalledWith(share.url));
    expect(methods.createShare).toHaveBeenCalledWith('chat', {
      threadId: 'branch',
      digest: preview.digest,
      audience: 'organization',
      expiresInDays: 7,
      acknowledgePublic: false,
    });
    expect(await screen.findByText('sharing.copied')).toBeVisible();
  });
  it('requires public consent and honors server policy', async () => {
    wrap();
    await screen.findByText('Shared answer');
    fireEvent.change(screen.getByLabelText('sharing.audience'), {
      target: { value: 'public' },
    });
    expect(screen.getByText('sharing.create')).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByText('sharing.create')).toBeEnabled();
  });
  it('does not offer public sharing when the server disables it', async () => {
    methods.previewShare.mockResolvedValue({
      ...preview,
      publicSharingEnabled: false,
    });
    wrap();
    await screen.findByText('Shared answer');
    expect(screen.queryByRole('option', { name: 'sharing.public' })).toBeNull();
  });
  it('can revoke an existing share even when a new snapshot is unavailable', async () => {
    methods.previewShare.mockRejectedValue(new Error('empty'));
    methods.listShares.mockResolvedValue([share]);
    wrap();
    fireEvent.click(await screen.findByText('sharing.revoke'));
    await waitFor(() =>
      expect(methods.revokeShare).toHaveBeenCalledWith('chat', 'share'),
    );
    await waitFor(() =>
      expect(screen.queryByText('sharing.revoke')).toBeNull(),
    );
  });
  it('does not report a link copied after a stale-preview conflict', async () => {
    methods.createShare.mockRejectedValue(new Error('conflict'));
    wrap();
    await screen.findByText('Shared answer');
    fireEvent.click(screen.getByText('sharing.create'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'sharing.createFailed',
    );
    expect(clipboard).not.toHaveBeenCalled();
  });
  it('falls back to copying the exact URL after clipboard activation expires', async () => {
    clipboard.mockRejectedValue(new Error('NotAllowedError'));
    const exec = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: exec,
    });
    wrap();
    await screen.findByText('Shared answer');
    fireEvent.click(screen.getByText('sharing.create'));
    await screen.findByText('sharing.copied');
    expect(exec).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });
  it('updates portal radius and density while the dialog remains open', async () => {
    const { rerender } = wrap({
      radius: 'sharp',
      density: 'compact',
      colorScheme: 'light',
    });
    await screen.findByText('Shared answer');
    const dialog = screen.getByRole('dialog');
    expect(dialog.style.getPropertyValue('--chat-panel-radius')).toBe('0px');
    expect(dialog.style.getPropertyValue('--chat-density-scale')).toBe('0.75');
    rerender(
      <ThemeProvider
        theme={{ radius: 'round', density: 'spacious', colorScheme: 'dark' }}
      >
        <ConversationShareDialog {...props} />
      </ThemeProvider>,
    );
    expect(dialog.style.getPropertyValue('--chat-panel-radius')).toBe(
      'calc(var(--radius, 0.625rem) + 4px)',
    );
    expect(dialog.style.getPropertyValue('--chat-density-scale')).toBe('1.25');
  });
});
