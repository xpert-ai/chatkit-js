import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatGroupSnapshot } from '@xpert-ai/xpert-sdk';
import { Chat } from '../chat';
import { ThemeProvider } from '../../providers/Theme';
import type { GroupState } from './group-state';
import { getComposerSelectionOffset } from '../../lib/composer-parts';

const mocks = vi.hoisted(() => ({
  assistantRuntime: vi.fn(() => {
    throw new Error('Group must not initialize a private assistant stream');
  }),
  send: vi.fn(),
  control: vi.fn(),
  openRuntime: vi.fn(),
  parent: { isParentAvailable: false, sendEvent: vi.fn() },
  snapshot: null as ChatGroupSnapshot | null,
  live: {} as GroupState['live'],
  composerContext: vi
    .fn()
    .mockResolvedValue({ projectId: null, locked: false, busy: false }),
  scoped: {
    assistants: {
      getRuntimeCapabilities: vi
        .fn()
        .mockResolvedValue({ skills: [], plugins: [], subAgents: [] }),
      getResources: vi
        .fn()
        .mockResolvedValue({ items: [], total: 0, revision: 0 }),
      validateResources: vi.fn(async (_id, selection) => selection),
    },
    projects: {
      types: vi.fn().mockResolvedValue({ items: [] }),
      list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    },
    xperts: { listWorkspaceFiles: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US' },
  }),
}));
vi.mock('../../hooks/useParentMessenger', () => ({
  useParentMessenger: () => mocks.parent,
}));
vi.mock('../ui/chatkit-avatar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui/chatkit-avatar')>();
  return {
    ...actual,
    ChatkitAvatar: ({
      label,
      avatar,
      className,
    }: import('../ui/chatkit-avatar').ChatkitAvatarProps) => (
      <span
        className={className}
        data-avatar-url={avatar?.url}
        aria-label={label}
      />
    ),
  };
});
vi.mock('../chat/useAssistantConversation', () => ({
  useAssistantConversation: mocks.assistantRuntime,
}));
vi.mock('./GroupMembers', () => ({ GroupMembers: () => null }));
vi.mock('./GroupInteractions', () => ({ GroupInteractions: () => null }));
vi.mock('../../workbench/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../workbench/context')>()),
  useWorkbench: () => ({ openGroupAssistant: mocks.openRuntime }),
}));
vi.mock('./useGroupChat', () => {
  const client = {
    forGroupComposer: () => mocks.scoped,
    groups: {
      control: mocks.control,
      composerContext: mocks.composerContext,
      preferences: vi.fn().mockResolvedValue({}),
    },
  };
  return {
    useGroupChat: () => ({
      state: { snapshot: mocks.snapshot, live: mocks.live },
      connected: true,
      error: null,
      setError: vi.fn(),
      client,
      send: mocks.send,
      loadMore: vi.fn(),
    }),
  };
});
const member = (id: string, kind: 'user' | 'assistant') => ({
  id,
  subjectId: id,
  name: id.toUpperCase(),
  kind,
  role: 'member' as const,
  active: true,
});
const groupOptions = {
  api: {
    apiUrl: 'http://localhost:3310',
    getClientSecret: async () => 'test-group-session',
  },
  group: { id: 'd' },
};
function enterText(element: HTMLElement, value: string) {
  element.textContent = value;
  fireEvent.input(element);
}

describe('group conversation UI', () => {
  beforeEach(() => {
    mocks.assistantRuntime.mockClear();
    mocks.send.mockReset().mockResolvedValue(undefined);
    mocks.control.mockReset().mockResolvedValue(undefined);
    mocks.openRuntime.mockReset();
    mocks.live = {};
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    HTMLElement.prototype.scrollIntoView = vi.fn();
    mocks.snapshot = {
      id: 'd',
      title: 'D',
      threadId: 'd-thread',
      viewerParticipantId: 'b',
      xpertId: 'c',
      members: [
        member('a', 'user'),
        member('b', 'user'),
        member('c', 'assistant'),
        member('e', 'assistant'),
      ],
      messages: [
        {
          id: 'm1',
          clientMessageId: 'm1',
          sequence: 1,
          createdAt: '2026-10-08T00:00:00Z',
          text: 'Question from A',
          communication: {
            intent: 'request',
            senderId: 'a',
            recipientIds: ['b'],
            rootMessageId: 'm1',
            rootUserId: 'a',
            hop: 0,
          },
          deliveries: [],
        },
      ],
      runs: [{ participantId: 'c', runId: 'rc', status: 'busy' }],
      revision: 1,
      hasMore: false,
    };
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  it('keeps default skills available for submission without showing them as draft tags', async () => {
    const skills = ['drawing', 'design', 'quality'].map((id) => ({
      id,
      workspaceId: 'workspace',
      label: `Default ${id}`,
      default: true,
    }));
    mocks.scoped.assistants.getRuntimeCapabilities.mockResolvedValueOnce({
      skills,
      plugins: [],
      subAgents: [],
    });
    const { container } = render(<Chat options={groupOptions} />, {
      wrapper: ThemeProvider,
    });
    const input = screen.getByRole('textbox', { name: 'group.composer' });
    enterText(input, 'Please help');
    await waitFor(() =>
      expect(screen.getByLabelText('group.send')).toBeEnabled(),
    );
    expect(
      container.querySelector('[data-slot="composer-capability-chip"]'),
    ).toBeNull();
    fireEvent.click(screen.getByLabelText('group.send'));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
    expect(mocks.send.mock.calls[0][0]).toMatchObject({
      text: 'Please help',
      composer: {
        runtimeCapabilities: {
          skills: { ids: ['drawing', 'design', 'quality'] },
        },
      },
    });
  });
  it('uses the original avatar details dialog and a separate members dialog', async () => {
    const { container, rerender } = render(<Chat options={groupOptions} />, {
      wrapper: ThemeProvider,
    });
    const presence = container.querySelector(
      '[data-slot="assistant-presence"]',
    );
    expect(
      presence?.querySelector('[data-slot="group-avatar"]'),
    ).toBeInTheDocument();
    expect(presence).toHaveTextContent('group.members · group.connected');
    const trigger = screen.getByRole('button', {
      name: 'assistantPresence.open',
    });
    trigger.focus();
    fireEvent.click(trigger);
    expect(
      screen.getByRole('dialog', { name: 'group.details' }),
    ).toHaveAttribute('data-slot', 'assistant-summary-dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'group.closeDetails' }));
    await waitFor(() => expect(trigger).toHaveFocus());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const members = screen.getByRole('button', { name: 'group.membersTitle' });
    members.focus();
    fireEvent.click(members);
    expect(
      screen.getByRole('dialog', { name: 'group.membersTitle' }),
    ).toHaveAttribute('data-slot', 'dialog-content');
    fireEvent.click(
      screen.getByRole('button', { name: 'composer.resources.close' }),
    );
    await waitFor(() => expect(members).toHaveFocus());
    rerender(
      <Chat
        options={{ ...groupOptions, header: { character: { enabled: false } } }}
      />,
    );
    expect(
      container.querySelector('[data-slot="assistant-presence"]'),
    ).toBeNull();
    expect(screen.getByRole('heading', { name: 'D' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'group.details' }));
    expect(screen.getByRole('dialog', { name: 'group.details' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'group.closeDetails' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    rerender(
      <Chat options={{ ...groupOptions, header: { enabled: false } }} />,
    );
    expect(
      container.querySelector('[data-slot="chatkit-chat-header"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-slot="assistant-presence"]'),
    ).toBeNull();
    expect(mocks.assistantRuntime).not.toHaveBeenCalled();
  });
  it('retains the shared more-actions menu and settings dialog', async () => {
    if (typeof ResizeObserver === 'undefined') {
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe() {}
          unobserve() {}
          disconnect() {}
        },
      );
    }
    render(<Chat options={groupOptions} />, { wrapper: ThemeProvider });
    const more = screen.getByRole('button', { name: 'chat.moreActions' });
    fireEvent.keyDown(more, { key: 'Enter' });
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'settings.open' }),
    );
    expect(await screen.findByRole('dialog')).toBeVisible();
  });
  it('uses the original task-summary control with group runs instead of a private summary request', async () => {
    render(<Chat options={groupOptions} />, { wrapper: ThemeProvider });
    fireEvent.click(screen.getByRole('button', { name: 'taskSummary.open' }));
    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="task-summary-popover"]'),
      ).toHaveTextContent('C'),
    );
    expect(mocks.assistantRuntime).not.toHaveBeenCalled();
  });
  it('keeps mentions in message text without a duplicate recipient label above the bubble', () => {
    mocks.snapshot!.messages[0].text = '@B please confirm';
    const { container } = render(<Chat options={groupOptions} />, {
      wrapper: ThemeProvider,
    });
    const row = container.querySelector('#group-message-m1');
    expect(row).toHaveTextContent('@B please confirm');
    expect(row?.textContent?.match(/@B/g)).toHaveLength(1);
    expect(screen.getByText('group.reply')).toBeVisible();
  });
  it('opens the sender runtime from its name without adding a separate conversation action', () => {
    const source = mocks.snapshot!.messages[0];
    mocks.snapshot!.messages = [
      { ...source, runtimeParticipantIds: ['c'] },
      {
        ...source,
        id: 'm2',
        text: 'C asks E',
        runtimeParticipantIds: ['e', 'c'],
        communication: {
          ...source.communication,
          senderId: 'c',
          recipientIds: ['e'],
        },
      },
      {
        ...source,
        id: 'm3',
        text: 'C continues',
        runtimeParticipantIds: ['c'],
        communication: {
          ...source.communication,
          senderId: 'c',
          recipientIds: ['e'],
        },
      },
      {
        ...source,
        id: 'm4',
        text: 'E replies',
        runtimeParticipantIds: ['e'],
        communication: {
          ...source.communication,
          senderId: 'e',
          recipientIds: ['c'],
        },
      },
      {
        ...source,
        id: 'm5',
        text: 'No sender execution',
        runtimeParticipantIds: ['e'],
        communication: {
          ...source.communication,
          senderId: 'c',
          recipientIds: ['e'],
        },
      },
    ];
    const { container } = render(<Chat options={groupOptions} />, {
      wrapper: ThemeProvider,
    });
    expect(screen.queryByRole('button', { name: 'A' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'C' })).toHaveLength(1);
    expect(
      container.querySelector(
        '#group-message-m3 [data-slot="message-sender-name"]',
      ),
    ).toBeNull();
    expect(
      container.querySelector(
        '#group-message-m5 [data-slot="message-sender-name"]',
      )?.tagName,
    ).toBe('SPAN');
    expect(screen.queryByText('group.openRuntime')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'C' }));
    expect(mocks.openRuntime).toHaveBeenLastCalledWith(
      expect.objectContaining({
        messageId: 'm2',
        participantId: 'c',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'E' }));
    expect(mocks.openRuntime).toHaveBeenLastCalledWith(
      expect.objectContaining({
        messageId: 'm4',
        participantId: 'e',
      }),
    );
  });
  it('shows only the last time within five minutes, even across authors, and preserves long gaps', () => {
    const source = mocks.snapshot!.messages[0];
    mocks.snapshot!.messages = [
      { ...source, text: 'first', createdAt: '2026-10-08T00:00:00Z' },
      {
        ...source,
        id: 'm2',
        text: 'second',
        createdAt: '2026-10-08T00:05:00Z',
        communication: { ...source.communication, senderId: 'b' },
      },
      {
        ...source,
        id: 'm3',
        text: 'after gap',
        createdAt: '2026-10-08T00:10:01Z',
      },
    ];
    const { container, rerender } = render(<Chat options={groupOptions} />, {
      wrapper: ThemeProvider,
    });
    expect(container.querySelector('#group-message-m1 time')).toBeNull();
    expect(container.querySelector('#group-message-m2 time')).toBeVisible();
    expect(container.querySelector('#group-message-m3 time')).toBeVisible();
    mocks.snapshot!.messages.push({
      ...source,
      id: 'm4',
      text: 'new tail',
      createdAt: '2026-10-08T00:11:00Z',
    });
    rerender(<Chat options={groupOptions} />);
    expect(container.querySelector('#group-message-m3 time')).toBeNull();
    expect(container.querySelector('#group-message-m4 time')).toBeVisible();
    expect(container.querySelectorAll('time')).toHaveLength(2);
  });
  it('keeps each busy assistant avatar and loading below messages, with no duplicate inline indicator', () => {
    mocks.live = {
      live: { runId: 'rc', participantId: 'c', text: 'Working on it' },
    };
    mocks.snapshot!.runs.push({
      participantId: 'e',
      runId: 're',
      status: 'busy',
    });
    const { container, rerender } = render(<Chat options={groupOptions} />, {
      wrapper: ThemeProvider,
    });
    const activity = container.querySelector('[data-slot="group-run-status"]')!;
    const list = container.querySelector('[data-slot="chatkit-message-list"]')!;
    expect(
      list.compareDocumentPosition(activity) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      activity.closest('[data-slot="chatkit-chat-content"]'),
    ).not.toBeNull();
    expect(activity.closest('[data-slot="chatkit-chat-composer"]')).toBeNull();
    expect(activity.querySelector('[aria-label="C"]')).toBeVisible();
    expect(activity.querySelector('[aria-label="E"]')).toBeVisible();
    expect(screen.getAllByText('message.thinking')).toHaveLength(2);
    expect(list).not.toHaveTextContent('message.thinking');
    expect(list.querySelector('time')).toBeNull();
    expect(
      container.querySelector('#group-message-live [aria-label="C"]'),
    ).toBeNull();
    mocks.snapshot!.runs = [];
    mocks.live = {};
    rerender(<Chat options={groupOptions} />);
    expect(
      container.querySelector('[data-slot="group-run-status"]'),
    ).toBeNull();
    expect(list.querySelector('time')).toBeVisible();
  });
  it('loads group metadata without mounting the private assistant runtime', () => {
    const snapshot = mocks.snapshot;
    mocks.snapshot = null;
    const options = {
      api: {
        apiUrl: 'http://localhost:3310',
        getClientSecret: async () => 'test-group-session',
      },
      group: { id: 'd' },
    };
    const { rerender } = render(<Chat options={options} />, {
      wrapper: ThemeProvider,
    });
    expect(screen.getByLabelText('group.composer')).toHaveAttribute(
      'contenteditable',
      'false',
    );
    mocks.snapshot = snapshot;
    rerender(<Chat options={options} />);
    expect(screen.getByText('Question from A')).toBeVisible();
    expect(screen.getByLabelText('group.composer')).toHaveAttribute(
      'contenteditable',
      'true',
    );
    expect(mocks.assistantRuntime).not.toHaveBeenCalled();
  });
  it('clears draft and selected recipients when switching group identity', () => {
    const api = {
      apiUrl: 'http://localhost:3310',
      getClientSecret: async () => 'test-group-session',
    };
    const { rerender } = render(
      <Chat options={{ api, group: { id: 'd' } }} />,
      { wrapper: ThemeProvider },
    );
    enterText(screen.getByLabelText('group.composer'), '@E');
    fireEvent.keyDown(screen.getByLabelText('group.composer'), {
      key: 'Enter',
    });
    expect(screen.getByLabelText('group.composer')).toHaveTextContent('@E');
    rerender(<Chat options={{ api, group: { id: 'another-group' } }} />);
    expect(screen.getByLabelText('group.composer')).toBeEmptyDOMElement();
    expect(
      screen.getByRole('button', { name: 'group.sendTo' }),
    ).toHaveTextContent('C');
  });
  it('renders another human by identity and replies through correlation without spoofed authors', async () => {
    const { container } = render(
      <Chat
        options={{
          api: {
            apiUrl: 'http://localhost:3310',
            getClientSecret: async () => 'test-group-session',
          },
          group: { id: 'd' },
        }}
      />,
      {
        wrapper: ThemeProvider,
      },
    );
    expect(container.querySelector('[data-author="a"]')).toHaveClass(
      'justify-start',
    );
    fireEvent.click(screen.getByText('group.reply'));
    expect(
      container.querySelector('[data-slot="chatkit-chat-composer"]'),
    ).not.toHaveTextContent('Question from A');
    enterText(screen.getByLabelText('group.composer'), '@A Answer from B');
    await waitFor(() =>
      expect(screen.getByLabelText('group.send')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('group.send'));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
    expect(mocks.send.mock.calls[0][0]).toEqual({
      clientMessageId: expect.any(String),
      mentions: [{ participantId: 'a', start: 0, end: 2 }],
      replyToMessageId: 'm1',
      text: '@A Answer from B',
    });
  });
  it('selects @E by stable member ID, and offers no queue/resume mode for new messages', async () => {
    render(
      <Chat
        options={{
          api: {
            apiUrl: 'http://localhost:3310',
            getClientSecret: async () => 'test-group-session',
          },
          group: { id: 'd' },
        }}
      />,
      { wrapper: ThemeProvider },
    );
    const composer = screen.getByLabelText('group.composer');
    enterText(composer, '@E');
    await waitFor(() =>
      expect(screen.getByLabelText('group.send')).toBeEnabled(),
    );
    fireEvent.keyDown(composer, { key: 'Enter' });
    await waitFor(() =>
      expect(screen.getByLabelText('group.send')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('group.send'));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
    expect(mocks.send.mock.calls[0][0]).toMatchObject({
      mentions: [{ participantId: 'e', start: 0, end: 2 }],
    });
    expect(mocks.send.mock.calls[0][0]).not.toHaveProperty('mode');
    expect(screen.queryByText('queue')).not.toBeInTheDocument();
  });
  it('targets a human without invoking the default Assistant and keeps stop scoped to one run', async () => {
    render(
      <Chat
        options={{
          api: {
            apiUrl: 'http://localhost:3310',
            getClientSecret: async () => 'test-group-session',
          },
          group: { id: 'd' },
        }}
      />,
      { wrapper: ThemeProvider },
    );
    fireEvent.click(screen.getByLabelText('group.sendTo'));
    fireEvent.click(screen.getByText('@A', { selector: 'button span' }));
    enterText(screen.getByLabelText('group.composer'), '@A can you confirm?');
    await waitFor(() =>
      expect(screen.getByLabelText('group.send')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('group.send'));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
    expect(mocks.send.mock.calls[0][0]).toMatchObject({
      mentions: [{ participantId: 'a', start: 0, end: 2 }],
    });
    fireEvent.click(screen.getByText('group.stop'));
    expect(mocks.control).toHaveBeenCalledWith('d', 'c', {
      action: 'cancel',
      runId: 'rc',
    });
  });
  it('returns to the primary Assistant after deleting a selected mention', async () => {
    render(<Chat options={groupOptions} />, { wrapper: ThemeProvider });
    fireEvent.click(screen.getByLabelText('group.sendTo'));
    fireEvent.click(screen.getByText('@E', { selector: 'button span' }));
    expect(screen.getByLabelText('group.composer')).toHaveTextContent('@E');
    enterText(screen.getByLabelText('group.composer'), 'Please help');
    await waitFor(() =>
      expect(screen.getByLabelText('group.send')).toBeEnabled(),
    );
    expect(screen.getByLabelText('group.sendTo')).toHaveTextContent('C');
    fireEvent.click(screen.getByLabelText('group.send'));
    await waitFor(() =>
      expect(mocks.send).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Please help', mentions: [] }),
      ),
    );
    expect(mocks.send.mock.calls[0][0]).not.toHaveProperty('recipientIds');
  });
  it('uses the existing Chat viewport, transcript, dock and rich editor for groups', () => {
    const { container } = render(
      <Chat
        options={{
          api: {
            apiUrl: 'http://localhost:3310',
            getClientSecret: async () => 'test-group-session',
          },
          group: { id: 'd' },
        }}
      />,
      {
        wrapper: ThemeProvider,
      },
    );
    expect(container.querySelector('[data-chatkit-root]')).toBeInTheDocument();
    expect(
      container.querySelector('[data-slot="chatkit-chat-content"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-slot="chatkit-chat-composer"]'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('group.composer')).toHaveAttribute(
      'contenteditable',
      'true',
    );
    expect(container.querySelector('textarea')).toBeNull();
    expect(
      container.querySelector('[data-slot="chatkit-message-list"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-slot="composer-input-shell"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-slot="composer-action-bar"]'),
    ).toBeInTheDocument();
  });
  it('renders Assistant markdown with its own identity and aligns the viewer on the right', () => {
    mocks.snapshot!.members.find((member) => member.id === 'e')!.avatar = {
      url: 'https://example.com/e.png',
    };
    mocks.snapshot!.members.find((member) => member.id === 'b')!.avatar = {
      url: 'https://example.com/b.png',
    };
    const source = mocks.snapshot!.messages[0];
    mocks.snapshot!.messages.push({
      ...source,
      id: 'm2',
      text: '**Assistant answer**',
      communication: {
        ...source.communication,
        senderId: 'e',
        intent: 'reply',
        replyToMessageId: 'm1',
        recipientIds: ['a'],
      },
    });
    mocks.snapshot!.messages.push({
      ...source,
      id: 'm3',
      text: 'My update',
      communication: {
        ...source.communication,
        senderId: 'b',
        intent: 'message',
        recipientIds: [],
      },
    });
    const { container } = render(
      <Chat
        options={{
          api: {
            apiUrl: 'http://localhost:3310',
            getClientSecret: async () => 'test-group-session',
          },
          group: { id: 'd' },
        }}
      />,
      {
        wrapper: ThemeProvider,
      },
    );
    expect(
      container.querySelector('[data-author="e"] strong'),
    ).toHaveTextContent('Assistant answer');
    expect(screen.queryByRole('button', { name: /group.replyTo/ })).toBeNull();
    expect(container.querySelector('[data-author="e"]')).not.toHaveTextContent(
      'Question from A',
    );
    expect(container.querySelector('[data-author="a"]')).toHaveClass(
      'justify-start',
    );
    expect(container.querySelector('[data-author="b"]')).toHaveClass(
      'justify-end',
    );
    expect(
      container.querySelector('[data-author="e"] [data-avatar-url]'),
    ).toHaveAttribute('data-avatar-url', 'https://example.com/e.png');
    expect(
      container.querySelector('[data-author="b"] [data-avatar-url]'),
    ).toBeNull();
  });
  it('supports keyboard mention selection and does not send during IME composition', async () => {
    render(
      <Chat
        options={{
          api: {
            apiUrl: 'http://localhost:3310',
            getClientSecret: async () => 'test-group-session',
          },
          group: { id: 'd' },
        }}
      />,
      { wrapper: ThemeProvider },
    );
    const composer = screen.getByLabelText('group.composer');
    enterText(composer, '@');
    fireEvent.keyDown(composer, { key: 'ArrowDown' });
    fireEvent.keyDown(composer, { key: 'ArrowDown' });
    fireEvent.keyDown(composer, { key: 'Enter' });
    fireEvent.keyDown(composer, {
      key: 'Enter',
      isComposing: true,
      keyCode: 229,
    });
    expect(mocks.send).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByLabelText('group.send')).toBeEnabled(),
    );
    fireEvent.keyDown(screen.getByLabelText('group.composer'), {
      key: 'Enter',
    });
    await waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
    expect(mocks.send.mock.calls[0][0]).toMatchObject({
      mentions: [{ participantId: 'e', start: 0, end: 2 }],
    });
  });
  it('preserves line breaks in the shared editor and submits only on Enter', async () => {
    render(
      <Chat
        options={{
          api: {
            apiUrl: 'http://localhost:3310',
            getClientSecret: async () => 'test-group-session',
          },
          group: { id: 'd' },
        }}
      />,
      { wrapper: ThemeProvider },
    );
    let composer = screen.getByLabelText('group.composer');
    enterText(composer, 'First line');
    const range = document.createRange();
    range.selectNodeContents(composer);
    range.collapse(false);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    fireEvent.keyDown(composer, { key: 'Enter', shiftKey: true });
    expect(mocks.send).not.toHaveBeenCalled();
    composer = screen.getByLabelText('group.composer');
    expect(composer.textContent).toBe('First line\n');
    expect(getComposerSelectionOffset(composer)).toBe('First line\n'.length);
    composer.append(document.createTextNode('Second line'));
    fireEvent.input(composer);
    await waitFor(() =>
      expect(screen.getByLabelText('group.send')).toBeEnabled(),
    );
    fireEvent.keyDown(composer, { key: 'Enter' });
    await waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
    expect(mocks.send.mock.calls[0][0].text).toBe('First line\nSecond line');
  });
  it('retains the draft and idempotency key after a failed send', async () => {
    mocks.send.mockRejectedValueOnce(new Error('offline'));
    render(
      <Chat
        options={{
          api: {
            apiUrl: 'http://localhost:3310',
            getClientSecret: async () => 'test-group-session',
          },
          group: { id: 'd' },
        }}
      />,
      { wrapper: ThemeProvider },
    );
    enterText(screen.getByLabelText('group.composer'), 'Retry me');
    await waitFor(() =>
      expect(screen.getByLabelText('group.send')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('group.send'));
    await waitFor(() =>
      expect(screen.getByLabelText('group.send')).toBeEnabled(),
    );
    expect(screen.getByLabelText('group.composer')).toHaveTextContent(
      'Retry me',
    );
    await waitFor(() =>
      expect(screen.getByLabelText('group.send')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('group.send'));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
    expect(mocks.send.mock.calls[0][0].clientMessageId).toBe(
      mocks.send.mock.calls[1][0].clientMessageId,
    );
  });
  it('opens member suggestions when an @ mention is pasted into the existing editor', () => {
    render(
      <Chat
        options={{
          api: {
            apiUrl: 'http://localhost:3310',
            getClientSecret: async () => 'test-group-session',
          },
          group: { id: 'd' },
        }}
      />,
      { wrapper: ThemeProvider },
    );
    const composer = screen.getByLabelText('group.composer');
    const range = document.createRange();
    range.selectNodeContents(composer);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    fireEvent.paste(composer, { clipboardData: { getData: () => '@E' } });
    expect(screen.getByRole('option')).toHaveTextContent('@E');
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
