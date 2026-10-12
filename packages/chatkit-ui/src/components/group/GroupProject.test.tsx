import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Client,
  type ChatGroupProject,
  type ChatGroupSnapshot,
} from '@xpert-ai/xpert-sdk';
import { ProjectSelector } from '../composer/ProjectSelector';
import { useGroupProject } from './useGroupProject';
import { ThemeProvider } from '../../providers/Theme';
import type { ChatKitTheme } from '@xpert-ai/chatkit-types';
import { getSurfaceThemeStyle } from '../../lib/theme-surfaces';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US' },
  }),
}));
if (typeof ResizeObserver === 'undefined')
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
const group: ChatGroupSnapshot = {
  id: 'group',
  title: 'Batch project',
  threadId: 'thread',
  xpertId: 'coordinator',
  viewerParticipantId: 'human',
  revision: 1,
  hasMore: false,
  messages: [],
  runs: [],
  members: [
    {
      id: 'human',
      subjectId: 'user',
      name: 'Owner',
      kind: 'user',
      role: 'owner',
      active: true,
    },
    {
      id: 'coordinator-member',
      subjectId: 'coordinator',
      name: 'Coordinator',
      kind: 'assistant',
      role: 'member',
      active: true,
    },
    {
      id: 'worker-member',
      subjectId: 'worker',
      name: 'Worker',
      kind: 'assistant',
      role: 'member',
      active: true,
    },
  ],
};
function Harness({
  client,
  snapshot,
  done,
}: {
  client: Client;
  snapshot: ChatGroupSnapshot;
  done: () => void;
}) {
  const project = useGroupProject({ client, group: snapshot, onSaved: done });
  return (
    <>
      <ProjectSelector {...project.selector} />
      {project.error}
      {project.dialog}
    </>
  );
}
function setup() {
  const client = new Client({ apiUrl: 'https://example.test' });
  const scoped = new Client({ apiUrl: 'https://example.test/group-composer' });
  vi.spyOn(client, 'forGroupComposer').mockReturnValue(scoped);
  const unscopedGet = vi
    .spyOn(client.projects, 'get')
    .mockRejectedValue(new Error('Group scope required'));
  const read = vi.spyOn(client.groups, 'project').mockResolvedValue(null);
  vi.spyOn(scoped.projects, 'types').mockResolvedValue({ items: [] });
  vi.spyOn(scoped.projects, 'list').mockResolvedValue({
    items: [{ id: 'existing', name: 'Existing project', status: 'active' }],
    total: 1,
  });
  const scopedGet = vi.spyOn(scoped.projects, 'get').mockResolvedValue({
    id: 'existing',
    name: 'Existing project',
    status: 'active',
  });
  const create = vi.spyOn(scoped.projects, 'create');
  const save = vi.spyOn(client.groups, 'setProject').mockResolvedValue({
    projectId: 'created',
    name: 'Batch project',
    participantIds: ['coordinator-member', 'worker-member'],
  });
  const done = vi.fn();
  const show = (snapshot = group, theme: ChatKitTheme = {}) =>
    render(
      <ThemeProvider theme={theme}>
        <Harness client={client} snapshot={snapshot} done={done} />
      </ThemeProvider>,
    );
  return { client, read, create, save, done, show, scopedGet, unscopedGet };
}
async function openMenu() {
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'composer.projects.select' }),
    ).toBeEnabled(),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'composer.projects.select' }),
  );
}
async function createIntent() {
  await openMenu();
  const create = await screen.findByRole('button', {
    name: 'composer.projects.new',
  });
  await waitFor(() => expect(create).toBeEnabled());
  fireEvent.click(create);
  fireEvent.change(
    screen.getByRole('textbox', { name: 'composer.projects.namePlaceholder' }),
    { target: { value: 'Batch project' } },
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'composer.projects.create' }),
  );
  await screen.findByRole('checkbox', { name: 'Coordinator' });
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe('unified group Project menu', () => {
  it('creates only after participant confirmation and updates the same menu', async () => {
    const f = setup();
    f.show();
    await createIntent();
    expect(f.save).not.toHaveBeenCalled();
    expect(f.create).not.toHaveBeenCalled();
    expect(
      screen.getByRole('checkbox', { name: 'Coordinator' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Worker' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'group.project.enable' }),
    );
    await waitFor(() => expect(f.done).toHaveBeenCalledOnce());
    expect(f.save).toHaveBeenCalledWith('group', {
      project: {
        mode: 'create',
        id: expect.any(String),
        name: 'Batch project',
      },
      participantIds: ['coordinator-member'],
    });
    expect(
      screen.getByRole('button', { name: 'composer.projects.select' }),
    ).toHaveTextContent('Batch project');
    await openMenu();
    expect(
      screen.getByRole('button', { name: 'group.project.manage' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'composer.projects.new' }),
    ).toBeNull();
    expect(screen.queryByText('composer.projects.none')).toBeNull();
  });
  it('cancels without creating, binding or selecting a Project', async () => {
    const f = setup();
    f.show();
    await createIntent();
    fireEvent.click(
      screen.getByRole('button', { name: 'composer.resources.close' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(f.save).not.toHaveBeenCalled();
    expect(f.create).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'composer.projects.select' }),
    ).toHaveTextContent('composer.projects.select');
    expect(
      screen.getByRole('button', { name: 'composer.projects.select' }),
    ).toHaveFocus();
  });
  it('preserves unconfirmed members when the public group snapshot refreshes', async () => {
    const f = setup();
    const view = f.show();
    await createIntent();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Worker' }));
    view.rerender(
      <ThemeProvider>
        <Harness
          client={f.client}
          snapshot={{
            ...group,
            revision: group.revision + 1,
            members: group.members.map((member) => ({ ...member })),
          }}
          done={f.done}
        />
      </ThemeProvider>,
    );
    expect(screen.getByRole('checkbox', { name: 'Worker' })).not.toBeChecked();
    expect(f.client.forGroupComposer).toHaveBeenCalledOnce();
    fireEvent.click(
      screen.getByRole('button', { name: 'group.project.enable' }),
    );
    await waitFor(() => expect(f.done).toHaveBeenCalledOnce());
    expect(f.save).toHaveBeenCalledWith(
      'group',
      expect.objectContaining({ participantIds: ['coordinator-member'] }),
    );
  });
  it('reuses the creation identity after an uncertain response', async () => {
    const f = setup();
    f.save.mockRejectedValueOnce(new Error('timeout'));
    f.show();
    await createIntent();
    fireEvent.click(
      screen.getByRole('button', { name: 'group.project.enable' }),
    );
    await screen.findByRole('alert');
    expect(f.done).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'group.project.enable' }),
    );
    await waitFor(() => expect(f.done).toHaveBeenCalledOnce());
    expect(f.save.mock.calls[1]).toEqual(f.save.mock.calls[0]);
  });
  it('selects an existing Project through the same menu and confirms members', async () => {
    const f = setup();
    f.show();
    await openMenu();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Existing project' }),
    );
    await screen.findByRole('checkbox', { name: 'Worker' });
    expect(f.scopedGet).toHaveBeenCalledWith('existing', {
      signal: expect.any(AbortSignal),
    });
    expect(f.unscopedGet).not.toHaveBeenCalled();
    expect(f.save).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'group.project.enable' }),
    );
    await waitFor(() => expect(f.done).toHaveBeenCalledOnce());
    expect(f.save).toHaveBeenCalledWith('group', {
      project: { mode: 'existing', projectId: 'existing' },
      participantIds: ['coordinator-member', 'worker-member'],
    });
    expect(f.create).not.toHaveBeenCalled();
  });
  it('does not apply a late save response after leaving the form', async () => {
    const f = setup();
    let finish!: (project: ChatGroupProject) => void;
    f.save.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = f.show();
    await createIntent();
    fireEvent.click(
      screen.getByRole('button', { name: 'group.project.enable' }),
    );
    await waitFor(() => expect(f.save).toHaveBeenCalledOnce());
    view.unmount();
    await act(async () =>
      finish({
        projectId: 'created',
        name: 'Old group project',
        participantIds: ['coordinator-member'],
      }),
    );
    expect(f.done).not.toHaveBeenCalled();
  });
  it('keeps bound Projects accessible for member management, with no-op save disabled', async () => {
    const f = setup();
    f.read.mockResolvedValue({
      projectId: 'existing',
      name: 'Existing project',
      participantIds: ['coordinator-member'],
    });
    f.show();
    await openMenu();
    expect(screen.getByText('group.project.locked')).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'group.project.manage' }),
    );
    const worker = await screen.findByRole('checkbox', { name: 'Worker' });
    expect(worker).not.toBeChecked();
    expect(worker).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'group.project.bind' }),
    ).toBeDisabled();
    fireEvent.click(worker);
    fireEvent.click(screen.getByRole('button', { name: 'group.project.bind' }));
    await waitFor(() => expect(f.done).toHaveBeenCalledOnce());
    expect(f.save).toHaveBeenCalledWith('group', {
      project: { mode: 'existing', projectId: 'existing' },
      participantIds: ['coordinator-member', 'worker-member'],
    });
  });
  it('fails closed on unavailable context and gives non-owners a read-only menu', async () => {
    const f = setup();
    f.read.mockRejectedValueOnce(new Error('denied'));
    f.show();
    await screen.findByRole('alert');
    expect(
      screen.getByRole('button', { name: 'composer.projects.select' }),
    ).toBeDisabled();
    cleanup();
    f.read.mockResolvedValue({
      projectId: 'existing',
      name: 'Existing project',
      participantIds: ['coordinator-member'],
    });
    f.show({
      ...group,
      members: group.members.map((m) =>
        m.id === 'human' ? { ...m, role: 'member' } : m,
      ),
    });
    await openMenu();
    fireEvent.click(
      screen.getByRole('button', { name: 'group.project.viewMembers' }),
    );
    expect(
      await screen.findByRole('checkbox', { name: 'Worker' }),
    ).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'group.project.bind' }),
    ).toBeNull();
    expect(f.save).not.toHaveBeenCalled();
  });
  it('updates open menu and dialog portal tokens for both theme extremes', async () => {
    const f = setup();
    const dark: ChatKitTheme = {
      radius: 'sharp',
      density: 'compact',
      colorScheme: 'dark',
    };
    const light: ChatKitTheme = {
      radius: 'round',
      density: 'spacious',
      colorScheme: 'light',
    };
    const view = f.show(group, dark);
    await openMenu();
    const verify = (element: HTMLElement | null, theme: ChatKitTheme) => {
      if (!element) throw new Error('Expected an open themed surface');
      const style = getSurfaceThemeStyle(theme);
      for (const [key, value] of Object.entries(style)) {
        if (key.startsWith('--chat-'))
          expect(element.style.getPropertyValue(key)).toBe(String(value));
      }
    };
    verify(
      document.querySelector<HTMLElement>('[data-slot="popover-content"]'),
      dark,
    );
    view.rerender(
      <ThemeProvider theme={light}>
        <Harness client={f.client} snapshot={group} done={f.done} />
      </ThemeProvider>,
    );
    verify(
      document.querySelector<HTMLElement>('[data-slot="popover-content"]'),
      light,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Existing project' }),
    );
    await screen.findByRole('checkbox', { name: 'Worker' });
    verify(screen.getByRole('dialog'), light);
    view.rerender(
      <ThemeProvider theme={dark}>
        <Harness client={f.client} snapshot={group} done={f.done} />
      </ThemeProvider>,
    );
    verify(screen.getByRole('dialog'), dark);
  });
});
