import { fireEvent, render, screen, within } from '@testing-library/react';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PendingFollowUp } from '../../lib/follow-ups';
import { PendingFollowUps } from './pending-follow-ups';

const themeMock = vi.hoisted(() => ({
  theme: {
    radius: 'soft',
    density: 'normal',
  },
}));

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'chat.referencedContentOnly': 'Referenced content',
        'chat.followUps.pending': 'Pending Follow-up',
        'chat.followUps.queue': 'Queue',
        'chat.followUps.queueHint': 'Queue hint',
        'chat.followUps.steerHint': 'Steer hint',
        'chat.followUps.steerAction': 'Guide',
        'chat.followUps.sendNow': 'Send now',
        'chat.followUps.remove': 'Remove',
        'chat.followUps.more': 'More',
        'chat.followUps.edit': 'Edit',
        'chat.followUps.manualQueueHint': 'Manual queue hint',
      };
      return labels[key] ?? key;
    },
  }),
}));

vi.mock('../../providers/Theme', () => ({
  useTheme: () => ({
    theme: themeMock.theme,
    isDarkMode: false,
  }),
}));

function createQueueItem(
  id: string,
  input: string,
  overrides: Partial<PendingFollowUp> = {},
): PendingFollowUp {
  return {
    id,
    clientMessageId: id,
    mode: 'queue',
    request: {
      id,
      input: { input },
      followUpMode: 'queue',
    },
    createdAt: 1,
    ...overrides,
  };
}

function renderPendingFollowUps(
  items: PendingFollowUp[],
  props: Partial<React.ComponentProps<typeof PendingFollowUps>> = {},
) {
  const onPromoteToSteer = vi.fn();
  render(
    <PendingFollowUps
      items={items}
      isLoading={true}
      onPromoteToSteer={onPromoteToSteer}
      canSendNow={() => false}
      onSendNow={vi.fn()}
      onEdit={vi.fn()}
      onRemove={vi.fn()}
      {...props}
    />,
  );

  return { onPromoteToSteer };
}

describe('PendingFollowUps', () => {
  beforeEach(() => {
    themeMock.theme = {
      radius: 'soft',
      density: 'normal',
    };
  });

  it('shows a guide action only for ordinary queued items while loading', () => {
    const { onPromoteToSteer } = renderPendingFollowUps([
      createQueueItem('queue-a', 'A'),
      createQueueItem('queue-b', 'B', { queuedFromSteer: true }),
    ]);

    const guideButtons = screen.getAllByRole('button', { name: 'Guide' });
    expect(guideButtons).toHaveLength(1);

    fireEvent.click(guideButtons[0]);

    expect(onPromoteToSteer).toHaveBeenCalledWith('queue-a');
  });

  it('hides the guide action for already guided or idle queued items', () => {
    const { rerender } = render(
      <PendingFollowUps
        items={[createQueueItem('queue-b', 'B', { queuedFromSteer: true })]}
        isLoading={true}
        onPromoteToSteer={vi.fn()}
        canSendNow={() => false}
        onSendNow={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Guide' }),
    ).not.toBeInTheDocument();

    rerender(
      <PendingFollowUps
        items={[createQueueItem('queue-c', 'C')]}
        isLoading={false}
        onPromoteToSteer={vi.fn()}
        canSendNow={() => false}
        onSendNow={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Guide' }),
    ).not.toBeInTheDocument();
  });

  it('keeps editing and removal scoped to the selected queue item', () => {
    const onEdit = vi.fn();
    const onRemove = vi.fn();
    renderPendingFollowUps(
      [
        createQueueItem('queue-a', 'First message'),
        createQueueItem('queue-b', 'Second message'),
        createQueueItem('steer-c', 'Already steering', { mode: 'steer' }),
      ],
      { onEdit, onRemove },
    );

    const rows = screen.getAllByRole('listitem');
    fireEvent.click(within(rows[1]).getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledWith('queue-b');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(within(rows[0]).getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledWith('queue-a');
    expect(within(rows[2]).queryByRole('button')).not.toBeInTheDocument();
  });

  it('previews an attached image and falls back when it cannot load', () => {
    const item = createQueueItem('image', 'Review this picture');
    item.request.input.references = [
      {
        id: 'image-ref',
        type: 'image',
        name: 'Screenshot',
        text: '',
        url: '/preview.png',
      },
    ];
    renderPendingFollowUps([item]);
    const image = screen.getByRole('img', { name: 'Screenshot' });
    expect(image).toHaveAttribute('src', '/preview.png');
    fireEvent.error(image);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Review this picture')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guide' })).toBeEnabled();
  });

  it('keeps manual sending available and updates an open menu with theme changes', () => {
    const onSendNow = vi.fn();
    const props = {
      items: [createQueueItem('manual', 'Send later')],
      isLoading: false,
      onPromoteToSteer: vi.fn(),
      canSendNow: () => true,
      onSendNow,
      onEdit: vi.fn(),
      onRemove: vi.fn(),
    };
    const { rerender } = render(<PendingFollowUps {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send now' }));
    expect(onSendNow).toHaveBeenCalledWith('manual');
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    themeMock.theme = { radius: 'sharp', density: 'spacious' };
    rerender(<PendingFollowUps {...props} />);
    const menu = screen.getByRole('dialog');
    expect(menu.style.getPropertyValue('--chat-panel-radius')).toBe('0px');
    expect(menu.style.getPropertyValue('--chat-density-scale')).toBe('1.25');
    expect(within(menu).getByRole('button', { name: 'Edit' })).toBeVisible();
  });
});
