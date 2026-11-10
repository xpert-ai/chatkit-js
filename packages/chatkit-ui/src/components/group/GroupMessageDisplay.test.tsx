import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { A2UIProvider } from '@xpert-ai/a2ui-react';
import { ResourceCardContext } from '../../resource-cards/context';
import { groupDisplays } from './group-display';
import { GroupMessageDisplay } from './GroupMessageDisplay';
import { getGroupMessageListProps } from './getGroupMessageListProps';
import { MessageList } from '../thread/MessageList';
import { ThemeProvider } from '../../providers/Theme';
import type { ChatGroupSnapshot, Client } from '@xpert-ai/xpert-sdk';

const app = {
  type: 'component' as const,
  id: 'app',
  data: {
    type: 'McpApp',
    appInstanceId: 'private-app',
    appInstanceToken: 'private-token',
    toolResult: { content: [{ type: 'text', text: 'Inventory result' }] },
  },
};
const card = {
  type: 'resource_card' as const,
  id: 'card',
  messageId: 'private-message',
  data: {
    title: 'Inventory card',
    resource: { namespace: 'test', type: 'report', id: 'report' },
    open: { target: 'workbench.view', viewKey: 'reports' },
  },
};
const widget = {
  id: 'widget',
  type: 'component' as const,
  data: {
    type: 'Widget',
    widgets: [
      {
        name: 'data',
        presentation: {
          summary: 'Complete query result',
          timestamp: '2026-11-09T01:38:13Z',
          timestampLabel: 'Query time',
          details: [{ label: 'Dataset', value: 'inventory_metrics' }],
        },
        messages: [
          {
            surfaceUpdate: {
              surfaceId: 'default',
              components: [
                {
                  id: 'root',
                  component: {
                    Column: { children: { explicitList: ['text', 'button'] } },
                  },
                },
                {
                  id: 'text',
                  component: {
                    Text: { text: { literalString: 'Widget result' } },
                  },
                },
                {
                  id: 'button',
                  component: {
                    Button: {
                      child: 'button-label',
                      action: { name: 'source-action' },
                    },
                  },
                },
                {
                  id: 'button-label',
                  component: {
                    Text: { text: { literalString: 'Run action' } },
                  },
                },
              ],
            },
          },
          { beginRendering: { surfaceId: 'default', root: 'root' } },
        ],
      },
    ],
  },
};

describe('group result snapshots', () => {
  it('opens Artifact cards only through the explicit group action and explains snapshot-only cards accurately', async () => {
    const sourceOpen = vi.fn();
    const groupOpen = vi.fn().mockResolvedValue({
      success: false,
      code: 'unavailable',
      message: 'Ask the group owner to accept the grant.',
    });
    const artifact = {
      ...card,
      data: {
        ...card.data,
        resource: { ...card.data.resource, artifactId: 'artifact' },
      },
    };
    const blocks = groupDisplays({ display: [artifact] });
    const view = render(
      <ResourceCardContext.Provider value={{ openResourceCard: sourceOpen }}>
        <GroupMessageDisplay
          messageId="public-message"
          blocks={blocks}
          onOpenResourceCard={groupOpen}
        />
      </ResourceCardContext.Provider>,
    );
    expect(groupOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Inventory card/ }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Ask the group owner',
      ),
    );
    expect(groupOpen).toHaveBeenCalledWith(
      expect.objectContaining({ data: artifact.data }),
      'public-message',
    );
    expect(sourceOpen).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toBeEnabled();
    view.rerender(
      <GroupMessageDisplay
        messageId="public-message"
        blocks={groupDisplays({ display: [card] })}
        onOpenResourceCard={groupOpen}
      />,
    );
    expect(screen.getByRole('button')).toBeDisabled();
    expect(
      screen.queryByText(/Workbench is not enabled|当前对话未启用 Workbench/),
    ).toBeNull();
    expect(
      screen.getByText(/This card is a result snapshot|此卡片为结果快照/),
    ).toBeInTheDocument();
  });
  it('ignores unknown tools, malformed widgets, raw output and source App authority', () => {
    const blocks = groupDisplays({
      display: [
        app,
        card,
        widget,
        { type: 'reasoning', text: 'private' },
        {
          type: 'component' as const,
          id: 'tool',
          data: { category: 'Tool', output: 'private' },
        },
        { ...widget, data: { type: 'Widget', widgets: [{}] } },
      ],
    });
    expect(blocks.map((b) => b.kind)).toEqual(['mcp', 'resource', 'widget']);
    expect(JSON.stringify(blocks)).not.toMatch(/private|appInstance|toolInput/);
    expect(groupDisplays({})).toEqual([]);
  });
  it('renders existing cards and widgets without inheriting actions or connecting an App session', async () => {
    const action = vi.fn(),
      openResourceCard = vi.fn();
    render(
      <ResourceCardContext.Provider value={{ openResourceCard }}>
        <A2UIProvider onAction={action}>
          <GroupMessageDisplay
            messageId="group-message"
            blocks={groupDisplays({ display: [app, card, widget] })}
          />
        </A2UIProvider>
      </ResourceCardContext.Provider>,
    );
    expect(await screen.findByText('Widget result')).toBeInTheDocument();
    const detail = screen.getByText('inventory_metrics').closest('details');
    expect(detail).not.toHaveAttribute('open');
    expect(detail?.closest('fieldset')).toBeNull();
    fireEvent.click(detail!.querySelector('summary')!);
    expect(detail).toHaveAttribute('open');
    expect(screen.getByText('Complete query result')).toBeInTheDocument();
    expect(screen.getByTitle('2026-11-09T01:38:13Z')).toHaveAttribute(
      'dateTime',
      '2026-11-09T01:38:13Z',
    );
    expect(screen.getByText('Inventory card')).toBeInTheDocument();
    expect(screen.getByText(/Inventory result/)).toBeInTheDocument();
    const run = screen.getByRole('button', { name: 'Run action' });
    expect(run).toBeDisabled();
    fireEvent.click(run);
    expect(action).not.toHaveBeenCalled();
    expect(openResourceCard).not.toHaveBeenCalled();
    expect(document.querySelector('iframe')).toBeNull();
    expect(
      screen.getByRole('button', { name: /Inventory card/ }),
    ).toBeDisabled();
  });
  it('renders card-only Assistant messages through the complete message list and rejects human-injected components', async () => {
    const message = {
      id: 'message',
      clientMessageId: 'client',
      sequence: 1,
      text: '',
      display: [app, card, widget],
      createdAt: '2026-11-09T00:00:00Z',
      deliveries: [],
      communication: {
        senderId: 'assistant',
        recipientIds: [],
        intent: 'message' as const,
        rootMessageId: 'root',
        rootUserId: 'viewer',
        hop: 1,
      },
    };
    const group: ChatGroupSnapshot = {
      id: 'group',
      threadId: 'thread',
      title: 'Group',
      viewerParticipantId: 'viewer',
      xpertId: 'xpert',
      members: [
        {
          id: 'assistant',
          kind: 'assistant',
          subjectId: 'xpert',
          name: 'Assistant',
          role: 'member',
          active: true,
        },
      ],
      messages: [message],
      runs: [],
      hasMore: false,
      revision: 1,
    };
    const input = {
      t: ((key: string) => key) as Parameters<
        typeof getGroupMessageListProps
      >[0]['t'],
      group,
      live: {},
      client: {} as Client,
      onReply: vi.fn(),
      onError: vi.fn(),
    };
    const props = getGroupMessageListProps(input);
    expect(props.messages).toHaveLength(1);
    const view = render(
      <ThemeProvider>
        <MessageList {...props} />
      </ThemeProvider>,
    );
    expect(await screen.findByText('Widget result')).toBeInTheDocument();
    expect(screen.getByText('Inventory card')).toBeInTheDocument();
    expect(screen.getByText(/Inventory result/)).toBeInTheDocument();
    expect(screen.getByTestId('group-display')).toBeInTheDocument();
    expect(
      screen
        .getByTestId('group-display')
        .closest('[data-slot="message-footer"]'),
    ).toBeNull();
    group.members[0].kind = 'user';
    view.rerender(
      <ThemeProvider>
        <MessageList {...getGroupMessageListProps(input)} />
      </ThemeProvider>,
    );
    expect(screen.queryByTestId('group-display')).toBeNull();
    // A timestamp/footer alone must not turn an empty Assistant record into a visible message.
    group.members[0].kind = 'assistant';
    message.display = [];
    view.rerender(
      <ThemeProvider>
        <MessageList {...getGroupMessageListProps(input)} />
      </ThemeProvider>,
    );
    expect(document.getElementById('group-message-message')).toBeNull();
  });
});
