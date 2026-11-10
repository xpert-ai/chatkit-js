import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  ChatGroupResourceLink,
  ChatGroupSnapshot,
  Client,
} from '@xpert-ai/xpert-sdk';
import { GroupResourceCards } from './GroupResourceCards';
import { getGroupMessageListProps } from '../getGroupMessageListProps';
import { MessageList } from '../../thread/MessageList';
import { ThemeProvider } from '../../../providers/Theme';

const link: ChatGroupResourceLink = {
  title: 'Inventory by plant',
  projectId: 'project',
  resource: { kind: 'group-reference', id: 'reference' },
};
const group: ChatGroupSnapshot = {
  id: 'group',
  title: 'Meeting',
  threadId: 'thread',
  xpertId: 'assistant',
  viewerParticipantId: 'viewer',
  members: [
    {
      id: 'assistant',
      kind: 'assistant',
      subjectId: 'assistant',
      name: 'Analyst',
      role: 'member',
      active: true,
    },
  ],
  messages: [
    {
      id: 'message',
      clientMessageId: 'client-message',
      sequence: 1,
      text: link.title,
      createdAt: '2026-11-10T00:00:00Z',
      deliveries: [],
      communication: {
        senderId: 'assistant',
        recipientIds: [],
        intent: 'message',
        rootMessageId: 'root',
        rootUserId: 'viewer',
        hop: 1,
        resourceLinks: [link],
      },
    },
  ],
  runs: [],
  hasMore: false,
  revision: 1,
};
function messageProps(snapshot = group, onOpenResource = vi.fn()) {
  return getGroupMessageListProps({
    t: ((key: string) => key) as Parameters<
      typeof getGroupMessageListProps
    >[0]['t'],
    group: snapshot,
    live: {},
    client: {} as Client,
    onReply: vi.fn(),
    onError: vi.fn(),
    onOpenResource,
  });
}

describe('group navigation resource cards', () => {
  it('renders the declared type icon and falls back when no supported icon is supplied', () => {
    const { container, rerender } = render(
      <GroupResourceCards
        links={[{ ...link, icon: { type: 'emoji', value: '📊' } }]}
      />,
    );
    expect(screen.getByText('📊')).toBeTruthy();
    expect(container.querySelector('.lucide-share-2')).toBeNull();
    rerender(<GroupResourceCards links={[link]} />);
    expect(container.querySelector('.lucide-share-2')).toBeTruthy();
    rerender(
      <GroupResourceCards
        links={[
          { ...link, icon: { type: 'lottie', value: 'unsupported.json' } },
        ]}
      />,
    );
    expect(container.querySelector('.lucide-share-2')).toBeTruthy();
  });
  it('replaces the generated title bubble with one body card and leaves history inert', async () => {
    const onOpen = vi.fn();
    const props = messageProps(group, onOpen);
    render(
      <ThemeProvider>
        <MessageList {...props} />
      </ThemeProvider>,
    );
    expect(props.messages[0].content).toBe('');
    expect(screen.getAllByText(link.title)).toHaveLength(1);
    expect(screen.getAllByTestId('resource-card')).toHaveLength(1);
    expect(
      screen
        .getByTestId('group-resource-cards')
        .closest('[data-slot="message-footer"]'),
    ).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(link.title) }),
    );
    await waitFor(() => expect(onOpen).toHaveBeenCalledExactlyOnceWith(link));
  });
  it('preserves independent explanations and deduplicates only the exact multi-resource fallback', () => {
    const second = {
      ...link,
      title: 'Sales',
      resource: { kind: 'project-content' as const, id: 'sales' },
    };
    const message = {
      ...group.messages[0],
      text: 'Please review these before the meeting.',
      communication: {
        ...group.messages[0].communication,
        resourceLinks: [link, second],
      },
    };
    expect(
      messageProps({ ...group, messages: [message] }).messages[0].content,
    ).toBe(message.text);
    expect(
      messageProps({
        ...group,
        messages: [{ ...message, text: `${link.title}\n${second.title}` }],
      }).messages[0].content,
    ).toBe('');
  });
  it('supports card-only history and does not hide a plain message with the same title', () => {
    const onlyCard = { ...group.messages[0], text: '' };
    const props = messageProps({ ...group, messages: [onlyCard] });
    expect(props.messageContext.message.hasRenderableContent).toBe(true);
    const plain = {
      ...group.messages[0],
      communication: { ...group.messages[0].communication, resourceLinks: [] },
    };
    expect(
      messageProps({ ...group, messages: [plain] }).messages[0].content,
    ).toBe(link.title);
  });
  it('uses resource scope labels without claiming project editing access or an invented version', () => {
    render(
      <GroupResourceCards
        links={[
          link,
          {
            ...link,
            title: 'Project result',
            resource: { kind: 'project-content', id: 'content' },
          },
        ]}
      />,
    );
    expect(screen.getByText(/Fixed version|固定版本/)).toBeInTheDocument();
    expect(screen.getByText(/Project resource|项目资源/)).toBeInTheDocument();
    expect(screen.queryByText(/v1|Editable|可编辑/)).toBeNull();
    screen
      .getAllByRole('button')
      .forEach((button) => expect(button).toBeDisabled());
  });
  it('prevents duplicate opens while pending and allows retry after failure', async () => {
    let reject: (reason?: unknown) => void = () => {};
    const onOpen = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((_, fail) => {
            reject = fail;
          }),
      )
      .mockResolvedValue(undefined);
    render(<GroupResourceCards links={[link]} onOpen={onOpen} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await act(async () => reject(new Error('Access changed')));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
