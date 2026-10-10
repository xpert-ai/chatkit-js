import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client, type ChatGroupSnapshot } from '@xpert-ai/xpert-sdk';
import { GroupMembers } from './GroupMembers';
import { ThemeProvider } from '../../providers/Theme';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../ui/chatkit-avatar', async (original) => ({
  ...(await original<typeof import('../ui/chatkit-avatar')>()),
  ChatkitAvatar: ({
    label,
    avatar,
  }: import('../ui/chatkit-avatar').ChatkitAvatarProps) => (
    <img alt={label} src={avatar?.url} />
  ),
}));
const group: ChatGroupSnapshot = {
  id: 'team',
  title: 'Team',
  threadId: 'thread',
  xpertId: 'c',
  viewerParticipantId: 'a',
  revision: 1,
  hasMore: false,
  messages: [],
  runs: [],
  members: [
    {
      id: 'a',
      subjectId: 'a',
      name: 'Alice',
      kind: 'user',
      role: 'owner',
      active: true,
    },
    {
      id: 'b',
      subjectId: 'b',
      name: 'Bob',
      kind: 'user',
      role: 'member',
      active: true,
    },
    {
      id: 'c',
      subjectId: 'c',
      name: 'Assistant C',
      kind: 'assistant',
      role: 'member',
      active: true,
      avatar: { url: '/c.png' },
    },
    {
      id: 'e',
      subjectId: 'e',
      name: 'Assistant E',
      kind: 'assistant',
      role: 'member',
      active: true,
      avatar: { url: '/e.png' },
    },
  ],
};
function setup(snapshot = group) {
  const client = new Client({ apiUrl: 'https://example.test' });
  const candidates = vi.spyOn(client.groups, 'candidates').mockResolvedValue([
    {
      kind: 'assistant',
      subjectId: 'c',
      name: 'Assistant C',
      avatar: { url: '/c.png' },
    },
    {
      kind: 'assistant',
      subjectId: 'f',
      name: 'Assistant F',
      avatar: { url: '/f.png' },
    },
  ]);
  const add = vi
    .spyOn(client.groups, 'addMember')
    .mockResolvedValue({
      ...group.members[2],
      id: 'f',
      subjectId: 'f',
      name: 'Assistant F',
    });
  const remove = vi
    .spyOn(client.groups, 'removeMember')
    .mockResolvedValue({ removed: true });
  const onError = vi.fn();
  render(<GroupMembers client={client} group={snapshot} onError={onError} />, {
    wrapper: ThemeProvider,
  });
  return { candidates, add, remove, onError };
}
describe('group member management', () => {
  beforeEach(() => {
    if (typeof ResizeObserver === 'undefined')
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe() {}
          unobserve() {}
          disconnect() {}
        },
      );
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it('separates people and assistants using keyboard-accessible tabs and actual member avatars', () => {
    setup();
    expect(screen.getByText('Alice')).toBeVisible();
    expect(screen.queryByText('Assistant C')).toBeNull();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'group.person 2' }), {
      key: 'ArrowRight',
    });
    expect(
      screen.getByRole('tab', { name: 'group.assistant 2' }),
    ).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Assistant C');
    expect(screen.getByAltText('Assistant E')).toHaveAttribute('src', '/e.png');
    expect(
      screen.queryByRole('button', { name: 'group.remove Assistant C' }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'group.remove Assistant E' }),
    ).toBeVisible();
  });
  it('searches scoped candidates, excludes existing members and invites the selected assistant', async () => {
    const { candidates, add } = setup();
    fireEvent.click(screen.getByRole('tab', { name: 'group.assistant 2' }));
    fireEvent.click(
      screen.getByRole('combobox', { name: 'group.selectMember' }),
    );
    const option = await screen.findByRole('option', { name: 'Assistant F' });
    expect(within(option).getByAltText('Assistant F')).toHaveAttribute(
      'src',
      '/f.png',
    );
    expect(screen.queryByRole('option', { name: 'Assistant C' })).toBeNull();
    fireEvent.change(
      screen.getByRole('combobox', { name: 'group.searchMembers' }),
      { target: { value: 'F' } },
    );
    await waitFor(() =>
      expect(candidates).toHaveBeenLastCalledWith(
        { kind: 'assistant', search: 'F', groupId: 'team' },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    fireEvent.click(await screen.findByRole('option', { name: 'Assistant F' }));
    fireEvent.click(screen.getByRole('button', { name: 'group.invite' }));
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith('team', {
        kind: 'assistant',
        subjectId: 'f',
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'group.invite' }),
      ).toBeDisabled(),
    );
  });
  it('clears a selected candidate when changing member type', async () => {
    const { add } = setup();
    fireEvent.click(screen.getByRole('tab', { name: 'group.assistant 2' }));
    fireEvent.click(
      screen.getByRole('combobox', { name: 'group.selectMember' }),
    );
    fireEvent.click(await screen.findByRole('option', { name: 'Assistant F' }));
    fireEvent.click(screen.getByRole('tab', { name: 'group.person 2' }));
    expect(
      screen.getByRole('combobox', { name: 'group.selectMember' }),
    ).not.toHaveTextContent('Assistant F');
    expect(screen.getByRole('button', { name: 'group.invite' })).toBeDisabled();
    expect(add).not.toHaveBeenCalled();
  });
  it('keeps the member list read-only for a non-owner', () => {
    const { candidates } = setup({ ...group, viewerParticipantId: 'b' });
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('button', { name: /group.remove/ })).toBeNull();
    expect(candidates).not.toHaveBeenCalled();
  });
});
