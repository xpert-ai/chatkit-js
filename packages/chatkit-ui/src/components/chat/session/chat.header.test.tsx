import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  Chat,
  baseChatOptions,
  mocks,
  setupChatTest,
} from '../testing/chat-fixture';

describe('Chat header identity', () => {
  setupChatTest();

  it('requires explicit opt-in and keeps header actions available while identity is hidden', async () => {
    const props = { clientSecret: 'secret', title: 'Header identity' };
    const options = {
      ...baseChatOptions,
      header: { character: { enabled: false } },
    };
    const view = render(<Chat {...props} options={options} />);
    await act(async () => {});
    expect(screen.queryByRole('heading', { name: props.title })).toBeNull();
    expect(
      view.container.querySelector('[data-slot="chatkit-header-identity"]'),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'history.newThread' }),
    ).toBeVisible();

    view.rerender(
      <Chat
        {...props}
        options={{
          ...options,
          header: { ...options.header, identity: { enabled: true } },
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: props.title })).toBeVisible();
    expect(
      view.container.querySelector('[data-slot="chatkit-header-identity"]'),
    ).toBeVisible();

    view.rerender(
      <Chat
        {...props}
        options={{
          ...options,
          header: { ...options.header, identity: { enabled: false } },
        }}
      />,
    );
    expect(screen.queryByRole('heading', { name: props.title })).toBeNull();
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'chat.moreActions' }),
      { key: 'Enter' },
    );
    expect(
      await screen.findByRole('menuitem', { name: 'history.threadHistory' }),
    ).toBeVisible();
  });

  it('shows a disabled share action for project conversations and enables it for personal conversations', async () => {
    const sharing = {
      previewShare: vi.fn(),
      createShare: vi.fn(),
      listShares: vi.fn(),
      revokeShare: vi.fn(),
    };
    Object.assign(mocks.stream.client.conversations, sharing);
    mocks.stream.threadId = 'thread';
    mocks.stream.conversationId = 'conversation';
    mocks.stream.projectScopeResolved = true;
    mocks.stream.projectId = 'project';
    try {
      const view = render(
        <Chat
          clientSecret="secret"
          options={baseChatOptions}
          activeProjectId="project"
        />,
      );
      await act(async () => {});
      expect(
        screen.getByRole('button', { name: 'sharing.action' }),
      ).toBeDisabled();
      expect(screen.getByLabelText('sharing.projectUnavailable')).toBeVisible();

      mocks.stream.projectId = undefined;
      view.rerender(<Chat clientSecret="secret" options={baseChatOptions} />);
      await act(async () => {});
      expect(
        screen.getByRole('button', { name: 'sharing.action' }),
      ).toBeEnabled();
      expect(screen.queryByLabelText('sharing.projectUnavailable')).toBeNull();
      expect(sharing.previewShare).not.toHaveBeenCalled();
      expect(sharing.createShare).not.toHaveBeenCalled();
      view.unmount();
    } finally {
      Object.keys(sharing).forEach((key) =>
        Reflect.deleteProperty(mocks.stream.client.conversations, key),
      );
    }
  });
});
