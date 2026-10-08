import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  baseChatOptions,
  Chat,
  mocks,
  setComposerText,
  setupChatTest,
} from '../testing/chat-fixture';

describe('Chat project scope', () => {
  setupChatTest();
  it('switches from an existing conversation without changing its stored scope or Connectors', async () => {
    mocks.stream.threadId = 'thread-1';
    mocks.stream.connectorBindingIds = ['binding-1'];
    const onProjectChange = vi.fn();
    const onConnectorsChange = vi.fn();
    render(
      <Chat
        clientSecret="secret"
        options={baseChatOptions}
        activeProjectId="project-1"
        projectsEnabled
        onProjectChange={onProjectChange}
        onConnectorsChange={onConnectorsChange}
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('project-selector')).toHaveTextContent(
      'project-1',
    );
    expect(
      document.querySelector('[data-slot="composer-project-rail"]'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('project-locked')).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="composer-input-shell"]'),
    ).not.toHaveClass('pb-composer-inset');
    fireEvent.click(screen.getByTestId('project-selector'));
    expect(onProjectChange).toHaveBeenCalledWith('project-2', undefined, {
      resumeLatestConversation: true,
    });
    expect(mocks.stream.setConnectorBindingIds).not.toHaveBeenCalled();
    expect(onConnectorsChange).not.toHaveBeenCalled();
    expect(mocks.stream.reset).not.toHaveBeenCalled();
    expect(mocks.stream.threadId).toBe('thread-1');
  });

  it('respects an explicitly locked host Project even with a navigation callback', async () => {
    mocks.stream.threadId = 'thread-1';
    render(
      <Chat
        clientSecret="secret"
        options={{
          ...baseChatOptions,
          composer: { projects: { locked: true } },
        }}
        activeProjectId="project-1"
        projectsEnabled
        onProjectChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('project-selector')).not.toBeInTheDocument();
    expect(screen.getByTestId('project-locked')).toHaveTextContent('project-1');
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('does not show Project selection for an existing no-Project conversation', async () => {
    mocks.stream.threadId = 'personal-thread';
    render(
      <Chat clientSecret="secret" options={baseChatOptions} projectsEnabled />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId('project-selector')).not.toBeInTheDocument();
    expect(screen.queryByTestId('project-locked')).not.toBeInTheDocument();
  });

  it('labels a project-local new conversation and keeps the selected Project', async () => {
    const onProjectChange = vi.fn();
    render(
      <Chat
        clientSecret="secret"
        options={baseChatOptions}
        activeProjectId="project-1"
        onProjectChange={onProjectChange}
      />,
    );
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'chat.moreActions' }),
      { key: 'Enter' },
    );
    const button = await screen.findByRole('menuitem', {
      name: 'history.newThreadInProject',
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(onProjectChange).toHaveBeenCalledWith('project-1', {
      mode: 'existing',
      projectId: 'project-1',
    });
    expect(mocks.stream.reset).toHaveBeenCalledWith(null, []);
  });

  it('uses the historical Project for file browsing and subsequent new conversations', async () => {
    mocks.stream.threadId = 'thread-b';
    mocks.stream.projectScopeResolved = true;
    mocks.stream.projectId = 'project-b';
    const onProjectChange = vi.fn();
    render(
      <Chat
        clientSecret="secret"
        options={baseChatOptions}
        activeProjectId="project-a"
        projectsEnabled
        onProjectChange={onProjectChange}
      />,
    );
    expect(screen.getByTestId('project-selector')).toHaveTextContent(
      'project-b',
    );
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'chat.moreActions' }),
      { key: 'Enter' },
    );
    const button = await screen.findByRole('menuitem', {
      name: 'history.newThreadInProject',
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(onProjectChange).toHaveBeenCalledWith('project-b', {
      mode: 'existing',
      projectId: 'project-b',
    });
  });

  it('clears the mounted Project when starting a new chat from personal history', async () => {
    mocks.stream.threadId = 'personal-thread';
    mocks.stream.projectScopeResolved = true;
    const onProjectChange = vi.fn();
    render(
      <Chat
        clientSecret="secret"
        options={baseChatOptions}
        activeProjectId="project-a"
        projectsEnabled
        onProjectChange={onProjectChange}
      />,
    );
    expect(screen.queryByTestId('project-locked')).not.toBeInTheDocument();
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'chat.moreActions' }),
      { key: 'Enter' },
    );
    const button = await screen.findByRole('menuitem', {
      name: 'history.newThread',
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(onProjectChange).toHaveBeenCalledWith(null, { mode: 'none' });
    expect(mocks.stream.reset).toHaveBeenCalledWith(null, []);
  });

  it('preserves plain text and clears conversation-scoped Connectors when the Project changes', async () => {
    const onProjectChange = vi.fn();
    const onConnectorsChange = vi.fn();
    mocks.stream.connectorBindingIds = ['binding-1'];
    render(
      <Chat
        clientSecret="secret"
        options={baseChatOptions}
        activeProjectId="project-1"
        projectsEnabled
        connectorsEnabled
        onProjectChange={onProjectChange}
        onConnectorsChange={onConnectorsChange}
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const textbox = setComposerText(screen.getByRole('textbox'), 'Keep me');
    fireEvent.click(screen.getByTestId('project-selector'));

    expect(textbox.textContent).toBe('Keep me');
    expect(mocks.stream.setConnectorBindingIds).toHaveBeenCalledWith([]);
    expect(onConnectorsChange).toHaveBeenCalledWith([]);
    expect(onProjectChange).toHaveBeenCalledWith('project-2', undefined, {
      resumeLatestConversation: true,
    });
  });

  it('locks the selected Project on the optimistic message before the thread id resolves', async () => {
    mocks.stream.messages = [
      {
        id: 'human-1',
        type: 'human',
        content: 'Hello',
      },
    ];
    render(
      <Chat
        clientSecret="secret"
        options={baseChatOptions}
        activeProjectId="project-1"
        projectsEnabled
        onProjectChange={vi.fn()}
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByTestId('project-selector')).not.toBeInTheDocument();
    expect(screen.getByTestId('project-locked')).toHaveTextContent('project-1');
  });

  it('loads project files and closes the file selector when the project changes', async () => {
    mocks.stream.client.projects.listFiles.mockResolvedValue([
      {
        filePath: 'query.sql',
        fullPath: 'query.sql',
        fileType: 'sql',
        hasChildren: false,
      },
    ]);
    const { rerender } = render(
      <Chat
        clientSecret="secret"
        options={baseChatOptions}
        activeProjectId="project-1"
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'composer.fileMentions.select' }),
    );
    await screen.findByRole('button', { name: 'query.sql' });
    expect(mocks.stream.client.projects.listFiles).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(
      mocks.stream.client.xperts.listWorkspaceFiles,
    ).not.toHaveBeenCalled();
    rerender(
      <Chat
        clientSecret="secret"
        options={baseChatOptions}
        activeProjectId="project-2"
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'query.sql' }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'composer.fileMentions.select' }),
    );
    await screen.findByRole('button', { name: 'query.sql' });
    expect(mocks.stream.client.projects.listFiles).toHaveBeenLastCalledWith(
      'project-2',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
