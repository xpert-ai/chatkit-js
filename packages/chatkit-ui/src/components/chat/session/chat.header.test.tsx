import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  Chat,
  baseChatOptions,
  mocks,
  setupChatTest,
} from '../testing/chat-fixture';

describe('Chat header identity', () => {
  setupChatTest();

  it('keeps the active conversation title beside New chat when identity is hidden', async () => {
    const title = 'A long current conversation title';
    mocks.stream.threadId = 'thread';
    mocks.stream.conversationId = 'conversation';
    Object.assign(mocks.stream, {
      conversation: { id: 'conversation', threadId: 'thread', title },
    });
    try {
      const view = render(
        <Chat clientSecret="secret" options={baseChatOptions} />,
      );
      await act(async () => {});
      const heading = screen
        .getByRole('button', { name: 'history.newThread' })
        .closest('[data-slot="chatkit-conversation-heading"]');
      expect(heading).toBeVisible();
      expect(within(heading as HTMLElement).getByText(title)).toHaveAttribute(
        'title',
        title,
      );
      expect(
        view.container.querySelector('[data-slot="chatkit-header-identity"]'),
      ).toBeNull();
      Object.assign(mocks.stream, {
        conversation: null,
        threadId: null,
        conversationId: null,
      });
      view.rerender(<Chat clientSecret="secret" options={baseChatOptions} />);
      expect(screen.queryByText(title)).toBeNull();
    } finally {
      Reflect.deleteProperty(mocks.stream, 'conversation');
    }
  });

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

  it('hides sharing for project conversations and exposes personal sharing in the shared menu', async () => {
    const sharing = {
      get: vi.fn().mockImplementation(async () => ({
        id: 'conversation',
        threadId: 'thread',
        projectId: mocks.stream.projectId,
      })),
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
      fireEvent.keyDown(
        screen.getByRole('button', { name: 'chat.moreActions' }),
        { key: 'Enter' },
      );
      await waitFor(() => expect(sharing.get).toHaveBeenCalled());
      expect(
        screen.queryByRole('menuitem', { name: 'conversationMenu.share' }),
      ).toBeNull();

      mocks.stream.projectId = undefined;
      view.rerender(<Chat clientSecret="secret" options={baseChatOptions} />);
      await act(async () => {});
      fireEvent.keyDown(
        screen.getByRole('button', { name: 'chat.moreActions' }),
        { key: 'Enter' },
      );
      await waitFor(() =>
        expect(
          screen.getByRole('menuitem', { name: 'conversationMenu.share' }),
        ).not.toHaveAttribute('aria-disabled'),
      );
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
