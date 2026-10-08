import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatKitOptions, ProjectSelection } from '@xpert-ai/chatkit-types';

import App from './App';
import { Chat } from './components/chat';
import { StreamProvider } from './providers/Stream';

vi.mock('@xpert-ai/a2ui-react', () => ({
  A2UIProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const parentMessengerMocks = vi.hoisted(() => ({
  sendCommand: vi.fn(),
  sendEvent: vi.fn(),
}));

vi.mock('./components/chat', () => ({
  Chat: vi.fn(
    ({
      onProjectChange,
      onProjectCreate,
      onConnectorsChange,
    }: {
      onProjectChange?: (
        projectId: string | null,
        selection?: ProjectSelection,
        navigation?: { resumeLatestConversation: boolean },
      ) => void;
      onProjectCreate?: (name: string) => void;
      onConnectorsChange?: (connectorBindingIds: string[]) => void;
    }) => {
      const [draft, setDraft] = React.useState('');
      return (
        <div data-testid="chat">
          <input
            data-testid="chat-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="button"
            data-testid="auto-new-project"
            onClick={() => onProjectChange?.(null, { mode: 'auto-new' })}
          />
          <button
            type="button"
            data-testid="select-project"
            onClick={() =>
              onProjectChange?.('project-2', undefined, {
                resumeLatestConversation: true,
              })
            }
          />
          <button
            type="button"
            data-testid="select-connectors"
            onClick={() => onConnectorsChange?.(['binding-1', 'binding-2'])}
          />
          <button
            type="button"
            data-testid="clear-project"
            onClick={() =>
              onProjectChange?.(null, undefined, {
                resumeLatestConversation: true,
              })
            }
          />
          <button
            type="button"
            data-testid="new-conversation"
            onClick={() =>
              onProjectChange?.('project-2', {
                mode: 'existing',
                projectId: 'project-2',
              })
            }
          />
          <button
            type="button"
            data-testid="create-project"
            onClick={() => onProjectCreate?.('Launch project')}
          />
        </div>
      );
    },
  ),
}));

vi.mock('./providers/Stream', () => ({
  StreamProvider: vi.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="stream-provider">{children}</div>
  )),
}));

vi.mock('./providers/Theme', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('./workbench/WorkbenchShell', () => ({
  WorkbenchShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="workbench-shell">{children}</div>
  ),
}));

vi.mock('./hooks/useParentMessenger', () => ({
  useParentMessenger: () => ({
    isParentAvailable: true,
    sendCommand: parentMessengerMocks.sendCommand,
    sendEvent: parentMessengerMocks.sendEvent,
  }),
}));

vi.mock('./i18n', () => ({
  getLanguage: () => 'en',
  setLanguage: vi.fn(),
}));

const options = {
  api: {
    apiUrl: '/api/ai',
    xpertId: 'xpert-1',
    projectId: 'project-1',
    getClientSecret: async () => 'secret',
  },
  composer: {
    projects: { enabled: true },
    connectors: { enabled: true },
  },
} satisfies ChatKitOptions;

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the chat shell while the parent client secret is initializing', () => {
    render(
      <App clientSecret="" options={options} isClientSecretInitializing />,
    );

    expect(screen.getByTestId('stream-provider')).toBeInTheDocument();
    expect(screen.getByTestId('chat')).toBeInTheDocument();
    expect(screen.getByTestId('workbench-shell')).toBeInTheDocument();
    expect(StreamProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: undefined,
        apiUrl: '/api/ai',
        xpertId: 'xpert-1',
        projectId: 'project-1',
      }),
      undefined,
    );
    expect(Chat).toHaveBeenCalledWith(
      expect.objectContaining({
        clientSecret: undefined,
        isClientSecretInitializing: true,
      }),
      undefined,
    );
  });

  it('mounts the StreamProvider once a client secret is available', () => {
    render(
      <App
        clientSecret="secret"
        organizationId="org-1"
        options={options}
        isClientSecretInitializing
      />,
    );

    expect(screen.getByTestId('stream-provider')).toBeInTheDocument();
    expect(screen.getByTestId('chat')).toBeInTheDocument();
    expect(StreamProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'secret',
        organizationId: 'org-1',
        apiUrl: '/api/ai',
        xpertId: 'xpert-1',
        projectId: 'project-1',
      }),
      undefined,
    );
  });

  it('mounts the workbench shell for native external assistants by default', () => {
    const { rerender } = render(
      <App clientSecret="secret" options={options} />,
    );
    expect(screen.getByTestId('workbench-shell')).toBeInTheDocument();
    rerender(
      <App
        clientSecret="secret"
        options={{
          ...options,
          workbench: { externalAssistants: { enabled: false } },
        }}
      />,
    );
    expect(screen.queryByTestId('workbench-shell')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat')).toBeInTheDocument();
  });

  it('mounts the workbench shell when remote views are enabled', () => {
    render(
      <App
        clientSecret="secret"
        options={{
          ...options,
          workbench: { enabled: true },
        }}
      />,
    );

    expect(screen.getByTestId('workbench-shell')).toBeInTheDocument();
    expect(screen.getByTestId('chat')).toBeInTheDocument();
  });

  it('keeps project and connector controls disabled for custom APIs by default', () => {
    const customOptions = {
      api: {
        url: '/chatkit',
        domainKey: 'domain-key',
        apiUrl: 'https://api.example.com/api/ai',
      },
    } satisfies ChatKitOptions;

    render(<App clientSecret="secret" options={customOptions} />);

    expect(StreamProvider).toHaveBeenLastCalledWith(
      expect.objectContaining({ projectId: undefined }),
      undefined,
    );
    expect(Chat).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeProjectId: undefined,
        projectsEnabled: false,
        connectorsEnabled: false,
      }),
      undefined,
    );
  });

  it('switches hosted project scope once and does not restore a stale configured id', () => {
    const scopedOptions = {
      ...options,
      initialThread: 'thread-1',
    } satisfies ChatKitOptions;
    const { rerender } = render(
      <App clientSecret="secret" options={scopedOptions} />,
    );

    fireEvent.change(screen.getByTestId('chat-draft'), {
      target: { value: 'unsent draft' },
    });
    fireEvent.click(screen.getByTestId('select-project'));

    // Reset the composer with the chat scope while Assistant-owned Views remain mounted.
    expect(screen.getByTestId('chat-draft')).toHaveValue('');

    expect(StreamProvider).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectId: 'project-2',
        initialThread: null,
        projectConversationRequest: { projectId: 'project-2' },
      }),
      undefined,
    );
    expect(parentMessengerMocks.sendEvent).toHaveBeenCalledTimes(1);
    expect(parentMessengerMocks.sendEvent).toHaveBeenCalledWith(
      'public_event',
      [
        'project.change',
        {
          projectId: 'project-2',
          selection: { mode: 'existing', projectId: 'project-2' },
        },
      ],
    );

    rerender(
      <App
        clientSecret="secret"
        options={{ ...scopedOptions, theme: 'dark' }}
      />,
    );

    expect(StreamProvider).toHaveBeenLastCalledWith(
      expect.objectContaining({ projectId: 'project-2' }),
      undefined,
    );
    expect(Chat).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeProjectId: 'project-2',
        projectsEnabled: true,
        connectorsEnabled: true,
      }),
      undefined,
    );

    rerender(
      <App
        clientSecret="secret"
        options={{ ...scopedOptions, initialThread: 'thread-2' }}
      />,
    );
    expect(StreamProvider).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectId: 'project-2',
        initialThread: 'thread-2',
      }),
      undefined,
    );

    rerender(
      <App
        clientSecret="secret"
        options={{
          ...scopedOptions,
          api: { ...scopedOptions.api, projectId: 'project-3' },
          initialThread: 'thread-2',
        }}
      />,
    );
    expect(StreamProvider).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectId: 'project-3',
        initialThread: null,
      }),
      undefined,
    );
    expect(parentMessengerMocks.sendEvent).toHaveBeenCalledTimes(1);
  });

  it('emits selected Connector binding ids through the public event', () => {
    render(<App clientSecret="secret" options={options} />);

    fireEvent.click(screen.getByTestId('select-connectors'));

    expect(parentMessengerMocks.sendEvent).toHaveBeenCalledWith(
      'public_event',
      [
        'connectors.change',
        { connectorBindingIds: ['binding-1', 'binding-2'] },
      ],
    );
  });

  it('does not resume history when the user explicitly starts a new conversation', () => {
    render(<App clientSecret="secret" options={options} />);
    fireEvent.click(screen.getByTestId('select-project'));
    expect(StreamProvider).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectConversationRequest: { projectId: 'project-2' },
      }),
      undefined,
    );
    fireEvent.click(screen.getByTestId('new-conversation'));
    expect(StreamProvider).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectId: 'project-2',
        initialThread: null,
        projectConversationRequest: null,
      }),
      undefined,
    );
  });

  it('keeps a project lookup through the host echo but lets an explicit thread win', () => {
    const { rerender } = render(
      <App clientSecret="secret" options={options} />,
    );
    fireEvent.click(screen.getByTestId('select-project'));
    const request = vi
      .mocked(StreamProvider)
      .mock.calls.at(-1)?.[0].projectConversationRequest;
    const echoed = {
      ...options,
      api: { ...options.api, projectId: 'project-2' },
    };
    rerender(<App clientSecret="secret" options={echoed} />);
    expect(
      vi.mocked(StreamProvider).mock.calls.at(-1)?.[0]
        .projectConversationRequest,
    ).toBe(request);
    rerender(
      <App
        clientSecret="secret"
        options={{ ...echoed, initialThread: 'host-thread' }}
      />,
    );
    expect(StreamProvider).toHaveBeenLastCalledWith(
      expect.objectContaining({
        initialThread: 'host-thread',
        projectConversationRequest: null,
      }),
      undefined,
    );
  });

  it.each(['assistant', 'organization'] as const)(
    'does not reuse a project lookup after the %s changes',
    (scope) => {
      const { rerender } = render(
        <App clientSecret="secret" organizationId="org-1" options={options} />,
      );
      fireEvent.click(screen.getByTestId('select-project'));
      rerender(
        <App
          clientSecret="secret"
          organizationId={scope === 'organization' ? 'org-2' : 'org-1'}
          options={
            scope === 'assistant'
              ? { ...options, api: { ...options.api, xpertId: 'assistant-2' } }
              : options
          }
        />,
      );
      expect(StreamProvider).toHaveBeenLastCalledWith(
        expect.objectContaining({ projectConversationRequest: null }),
        undefined,
      );
    },
  );

  it('clears an optional hosted project scope and emits the nullable public event', () => {
    render(<App clientSecret="secret" options={options} />);

    fireEvent.click(screen.getByTestId('clear-project'));

    expect(StreamProvider).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectId: undefined,
        initialThread: null,
      }),
      undefined,
    );
    expect(Chat).toHaveBeenLastCalledWith(
      expect.objectContaining({ activeProjectId: undefined }),
      undefined,
    );
    expect(parentMessengerMocks.sendEvent).toHaveBeenCalledOnce();
    expect(parentMessengerMocks.sendEvent).toHaveBeenCalledWith(
      'public_event',
      ['project.change', { projectId: null, selection: { mode: 'none' } }],
    );
  });

  it('keeps explicit no-project across rerenders and distinguishes it from automatic creation', () => {
    const autoOptions = {
      ...options,
      api: { ...options.api, projectId: undefined },
      composer: { projects: { enabled: true, autoNewEnabled: true } },
    } satisfies ChatKitOptions;
    const { rerender } = render(
      <App clientSecret="secret" options={autoOptions} />,
    );
    expect(StreamProvider).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectId: undefined,
        projectSelection: { mode: 'auto-new' },
      }),
      undefined,
    );
    fireEvent.click(screen.getByTestId('clear-project'));
    rerender(
      <App clientSecret="secret" options={{ ...autoOptions, theme: 'dark' }} />,
    );
    expect(StreamProvider).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectId: undefined,
        projectSelection: { mode: 'none' },
        initialThread: null,
      }),
      undefined,
    );
    expect(parentMessengerMocks.sendEvent).toHaveBeenLastCalledWith(
      'public_event',
      ['project.change', { projectId: null, selection: { mode: 'none' } }],
    );
    fireEvent.click(screen.getByTestId('auto-new-project'));
    expect(StreamProvider).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectId: undefined,
        projectSelection: { mode: 'auto-new' },
        initialThread: null,
      }),
      undefined,
    );
    expect(parentMessengerMocks.sendEvent).toHaveBeenLastCalledWith(
      'public_event',
      ['project.change', { projectId: null, selection: { mode: 'auto-new' } }],
    );
  });

  it('clears the old Project and thread when automatic creation is explicitly selected', () => {
    const scopedOptions = { ...options, initialThread: 'existing-thread' };
    const { rerender } = render(
      <App clientSecret="secret" options={scopedOptions} />,
    );
    fireEvent.click(screen.getByTestId('auto-new-project'));
    rerender(
      <App
        clientSecret="secret"
        options={{ ...scopedOptions, theme: 'dark' }}
      />,
    );
    expect(StreamProvider).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectId: undefined,
        projectSelection: { mode: 'auto-new' },
        initialThread: null,
      }),
      undefined,
    );
  });

  it('does not expose Project creation when the host disables it', () => {
    render(
      <App
        clientSecret="secret"
        options={{
          ...options,
          composer: {
            ...options.composer,
            projects: {
              ...options.composer.projects,
              createEnabled: false,
            },
          },
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('create-project'));

    expect(parentMessengerMocks.sendEvent).not.toHaveBeenCalled();
  });

  it('preserves Project creation for hosts that have not disabled it', () => {
    render(<App clientSecret="secret" options={options} />);

    fireEvent.click(screen.getByTestId('create-project'));

    expect(parentMessengerMocks.sendEvent).toHaveBeenCalledOnce();
    expect(parentMessengerMocks.sendEvent).toHaveBeenCalledWith(
      'public_event',
      ['effect', { name: 'project.create', data: { name: 'Launch project' } }],
    );
  });
});
