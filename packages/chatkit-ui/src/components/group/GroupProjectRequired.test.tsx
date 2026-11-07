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
import type { ChatGroupProject, ChatGroupSnapshot } from '@xpert-ai/xpert-sdk';
import { Chat } from '../chat';
import { ThemeProvider } from '../../providers/Theme';

const mocks = vi.hoisted(() => ({
  snapshot: null as ChatGroupSnapshot | null,
  send: vi.fn(),
  setError: vi.fn(),
  project: vi.fn(),
  setProject: vi.fn(),
  context: vi.fn(),
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
      list: vi.fn().mockResolvedValue({
        items: [{ id: 'project', name: 'Monthly review', status: 'active' }],
        total: 1,
      }),
      get: vi.fn().mockResolvedValue({
        id: 'project',
        name: 'Monthly review',
        status: 'active',
      }),
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
  useParentMessenger: () => ({ isParentAvailable: false, sendEvent: vi.fn() }),
}));
vi.mock('../chat/useAssistantConversation', () => ({
  useAssistantConversation: () => {
    throw new Error('Group must not start a private runtime');
  },
}));
vi.mock('./GroupMembers', () => ({ GroupMembers: () => null }));
vi.mock('./GroupInteractions', () => ({ GroupInteractions: () => null }));
vi.mock('../../workbench/context', async (original) => ({
  ...(await original<typeof import('../../workbench/context')>()),
  useWorkbench: () => ({ openGroupAssistant: vi.fn() }),
}));
vi.mock('./useGroupChat', () => {
  const client = {
    forGroupComposer: () => mocks.scoped,
    groups: {
      project: mocks.project,
      setProject: mocks.setProject,
      composerContext: mocks.context,
      preferences: vi.fn().mockResolvedValue({}),
    },
  };
  return {
    useGroupChat: () => ({
      state: { snapshot: mocks.snapshot, live: {} },
      connected: true,
      error: null,
      setError: mocks.setError,
      client,
      send: mocks.send,
      loadMore: vi.fn(),
    }),
  };
});
const options = {
  api: { apiUrl: 'http://localhost:3310', getClientSecret: async () => 'test' },
  group: { id: 'group' },
};
const required = {
  statusCode: 400,
  error: 'Bad Request',
  code: 'GROUP_PROJECT_REQUIRED',
  message: 'Project required',
  groupId: 'group',
  participantIds: ['assistant'],
};
const saved: ChatGroupProject = {
  projectId: 'project',
  name: 'Monthly review',
  participantIds: ['assistant'],
};

describe('Project setup before a group message is accepted', () => {
  beforeEach(() => {
    mocks.scoped.projects.types.mockResolvedValue({ items: [] });
    mocks.send
      .mockReset()
      .mockRejectedValueOnce({ status: 400, text: JSON.stringify(required) })
      .mockResolvedValue(undefined);
    mocks.setError.mockReset();
    mocks.project.mockReset().mockResolvedValue(null);
    mocks.context
      .mockReset()
      .mockResolvedValue({ projectId: null, locked: false, busy: false });
    mocks.setProject.mockReset().mockImplementation(async () => {
      mocks.project.mockResolvedValue(saved);
      mocks.context.mockResolvedValue({
        projectId: 'project',
        locked: true,
        busy: false,
      });
      return saved;
    });
    mocks.snapshot = {
      id: 'group',
      title: 'Monthly analysis',
      threadId: 'thread',
      xpertId: 'cfo',
      viewerParticipantId: 'human',
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
          id: 'assistant',
          subjectId: 'cfo',
          name: 'CFO',
          kind: 'assistant',
          role: 'member',
          active: true,
        },
      ],
      messages: [],
      runs: [],
      revision: 1,
      hasMore: false,
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
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
    vi.unstubAllGlobals();
  });
  async function submit() {
    render(<Chat options={options} />, { wrapper: ThemeProvider });
    const composer = screen.getByRole('textbox', { name: 'group.composer' });
    composer.textContent = 'What was last month’s revenue?';
    fireEvent.input(composer);
    await waitFor(() =>
      expect(screen.getByLabelText('group.send')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('group.send'));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
    return composer;
  }
  async function selectExistingProject() {
    const dialog = await screen.findByRole('dialog', {
      name: 'group.project.requiredTitle',
    });
    const selector = within(dialog).getByRole('button', {
      name: 'composer.projects.select',
    });
    await waitFor(() => expect(selector).toBeEnabled());
    fireEvent.click(selector);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Monthly review' }),
    );
    await screen.findByRole('checkbox', { name: 'CFO' });
  }
  it('selects an existing Project and automatically resumes the original message once', async () => {
    await submit();
    const dialog = await screen.findByRole('dialog', {
      name: 'group.project.requiredTitle',
    });
    expect(dialog).toHaveTextContent('CFO');
    expect(screen.getByLabelText('group.composer')).toHaveTextContent(
      'What was last month’s revenue?',
    );
    await selectExistingProject();
    expect(await screen.findByRole('checkbox', { name: 'CFO' })).toBeChecked();
    fireEvent.click(
      screen.getByRole('button', { name: 'group.project.enable' }),
    );
    await waitFor(() =>
      expect(mocks.setProject).toHaveBeenCalledWith('group', {
        project: { mode: 'existing', projectId: 'project' },
        participantIds: ['assistant'],
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
    expect(mocks.send.mock.calls[1][0].text).toBe(
      mocks.send.mock.calls[0][0].text,
    );
    expect(mocks.send.mock.calls[1][0].composer.projectId).toBe('project');
    expect(mocks.send.mock.calls[1][0].clientMessageId).toBe(
      mocks.send.mock.calls[0][0].clientMessageId,
    );
    await waitFor(() =>
      expect(screen.getByLabelText('group.composer')).toBeEmptyDOMElement(),
    );
  });
  it('adds required Assistants to an existing group Project with them preselected', async () => {
    mocks.project.mockResolvedValue({ ...saved, participantIds: [] });
    await submit();
    const dialog = await screen.findByRole('dialog', {
      name: 'group.project.requiredTitle',
    });
    expect(dialog).toHaveTextContent('group.project.requiredParticipants');
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'group.project.manage' }),
    );
    const member = await screen.findByRole('checkbox', { name: 'CFO' });
    expect(member).toBeChecked();
    expect(member).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'group.project.bind' }));
    await waitFor(() =>
      expect(mocks.setProject).toHaveBeenCalledWith('group', {
        project: { mode: 'existing', projectId: 'project' },
        participantIds: ['assistant'],
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
  });
  it('creates the primary Assistant Project type and automatically continues after binding', async () => {
    const projectType = {
      applicationKey: 'test:dashboard',
      projectTypeKey: 'dashboard',
    };
    mocks.scoped.projects.types.mockResolvedValue({
      defaultProjectType: projectType,
      items: [
        {
          ...projectType,
          applicationTitle: 'Dashboards',
          title: 'Dashboard project',
          binding: { kind: 'project' },
          available: true,
        },
      ],
    });
    await submit();
    const dialog = await screen.findByRole('dialog', {
      name: 'group.project.requiredTitle',
    });
    const selector = within(dialog).getByRole('button', {
      name: 'composer.projects.select',
    });
    await waitFor(() => expect(selector).toBeEnabled());
    fireEvent.click(selector);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'composer.projects.new · Dashboard project',
      }),
    );
    fireEvent.change(
      screen.getByRole('textbox', {
        name: 'composer.projects.namePlaceholder',
      }),
      { target: { value: 'October review' } },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'composer.projects.create' }),
    );
    await screen.findByRole('checkbox', { name: 'CFO' });
    expect(mocks.setProject).not.toHaveBeenCalled();
    expect(mocks.send).toHaveBeenCalledOnce();
    fireEvent.click(
      screen.getByRole('button', { name: 'group.project.enable' }),
    );
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
    expect(mocks.setProject).toHaveBeenCalledWith('group', {
      project: {
        mode: 'create',
        id: expect.any(String),
        name: 'October review',
        projectType,
      },
      participantIds: ['assistant'],
    });
    expect(mocks.send.mock.calls[1][0]).toEqual({
      ...mocks.send.mock.calls[0][0],
      composer: {
        ...mocks.send.mock.calls[0][0].composer,
        projectId: 'project',
      },
    });
    await waitFor(() =>
      expect(screen.getByLabelText('group.composer')).toBeEmptyDOMElement(),
    );
  });
  it('retains the draft after binding fails and resumes only after a successful retry', async () => {
    mocks.setProject.mockRejectedValueOnce(
      new Error('Project creation failed'),
    );
    await submit();
    await selectExistingProject();
    fireEvent.click(
      screen.getByRole('button', { name: 'group.project.enable' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Project creation failed',
    );
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('group.composer')).toHaveTextContent(
      'What was last month’s revenue?',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'group.project.enable' }),
    );
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
  });
  it('does not resume a cancelled send when Project setup is later opened manually', async () => {
    await submit();
    const dialog = await screen.findByRole('dialog', {
      name: 'group.project.requiredTitle',
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'composer.resources.close' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const selector = screen.getByRole('button', {
      name: 'composer.projects.select',
    });
    await waitFor(() => expect(selector).toBeEnabled());
    fireEvent.click(selector);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Monthly review' }),
    );
    await screen.findByRole('checkbox', { name: 'CFO' });
    fireEvent.click(
      screen.getByRole('button', { name: 'group.project.enable' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(screen.getByLabelText('group.send')).toBeEnabled(),
    );
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('group.composer')).toHaveTextContent(
      'What was last month’s revenue?',
    );
  });
  it('keeps the original draft if the resumed message fails to send', async () => {
    mocks.send.mockRejectedValueOnce(new Error('Connection interrupted'));
    await submit();
    await selectExistingProject();
    fireEvent.click(
      screen.getByRole('button', { name: 'group.project.enable' }),
    );
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(mocks.setError).toHaveBeenCalledWith('Connection interrupted'),
    );
    expect(screen.getByLabelText('group.composer')).toHaveTextContent(
      'What was last month’s revenue?',
    );
    fireEvent.click(screen.getByLabelText('group.send'));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(3));
    expect(mocks.send.mock.calls[2][0].clientMessageId).toBe(
      mocks.send.mock.calls[1][0].clientMessageId,
    );
  });
  it('resumes the pending message only after explicit Project reuse consent', async () => {
    await submit();
    const prompt = await screen.findByRole('dialog', {
      name: 'group.project.requiredTitle',
    });
    const selector = within(prompt).getByRole('button', {
      name: 'composer.projects.select',
    });
    await waitFor(() => expect(selector).toBeEnabled());
    fireEvent.click(selector);
    fireEvent.click(
      await screen.findByRole('button', { name: 'group.project.reuse' }),
    );
    const reuse = await screen.findByRole('dialog', {
      name: 'group.project.reuse',
    });
    fireEvent.click(
      within(reuse).getByRole('button', { name: 'composer.projects.select' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Monthly review' }),
    );
    expect(await screen.findByRole('checkbox', { name: 'CFO' })).toBeDisabled();
    const confirm = screen.getByRole('button', {
      name: 'group.project.reuseBind',
    });
    expect(confirm).toBeDisabled();
    expect(mocks.send).toHaveBeenCalledOnce();
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'group.project.reuseConfirm' }),
    );
    fireEvent.click(confirm);
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
    expect(mocks.setProject).toHaveBeenCalledWith('group', {
      project: { mode: 'existing', projectId: 'project', reuse: true },
      participantIds: ['assistant'],
    });
    expect(mocks.send.mock.calls[1][0].clientMessageId).toBe(
      mocks.send.mock.calls[0][0].clientMessageId,
    );
  });
  it('lets a non-owner dismiss the prompt without losing the draft or creating a Project', async () => {
    if (!mocks.snapshot) throw new Error('Expected the group fixture');
    mocks.snapshot.members[0].role = 'member';
    const composer = await submit();
    const dialog = await screen.findByRole('dialog', {
      name: 'group.project.requiredTitle',
    });
    expect(dialog).toHaveTextContent('group.project.requiredMember');
    expect(
      within(dialog).queryByRole('button', {
        name: 'composer.projects.select',
      }),
    ).toBeNull();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'composer.resources.close' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(composer).toHaveTextContent('What was last month’s revenue?');
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(mocks.setProject).not.toHaveBeenCalled();
  });
  it.each([
    new Error('This Assistant requires a Project workspace'),
    { ...required, groupId: 'another-group' },
  ])('keeps unrelated errors in the normal error flow', async (reason) => {
    mocks.send.mockReset().mockRejectedValue(reason);
    await submit();
    await waitFor(() => expect(mocks.setError).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
