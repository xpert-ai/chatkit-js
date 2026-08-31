import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';

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
      onProjectChange?: (projectId: string | null) => void;
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
            data-testid="select-project"
            onClick={() => onProjectChange?.('project-2')}
          />
          <button
            type="button"
            data-testid="select-connectors"
            onClick={() => onConnectorsChange?.(['binding-1', 'binding-2'])}
          />
          <button
            type="button"
            data-testid="clear-project"
            onClick={() => onProjectChange?.(null)}
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
    expect(screen.queryByTestId('workbench-shell')).not.toBeInTheDocument();
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

  it('mounts the workbench shell only when explicitly enabled', () => {
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

    expect(screen.getByTestId('chat-draft')).toHaveValue('unsent draft');

    expect(StreamProvider).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectId: 'project-2',
        initialThread: null,
      }),
      undefined,
    );
    expect(parentMessengerMocks.sendEvent).toHaveBeenCalledTimes(1);
    expect(parentMessengerMocks.sendEvent).toHaveBeenCalledWith(
      'public_event',
      ['project.change', { projectId: 'project-2' }],
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
        initialThread: 'thread-2',
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
      ['project.change', { projectId: null }],
    );
  });

  it('requests Project creation through the existing host effect channel', () => {
    render(<App clientSecret="secret" options={options} />);

    fireEvent.click(screen.getByTestId('create-project'));

    expect(parentMessengerMocks.sendEvent).toHaveBeenCalledOnce();
    expect(parentMessengerMocks.sendEvent).toHaveBeenCalledWith(
      'public_event',
      ['effect', { name: 'project.create', data: { name: 'Launch project' } }],
    );
  });
});
