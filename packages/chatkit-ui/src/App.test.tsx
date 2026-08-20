import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';

import App from './App';
import { Chat } from './components/chat';
import { StreamProvider } from './providers/Stream';

vi.mock('@xpert-ai/a2ui-react', () => ({
  A2UIProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('./components/chat', () => ({
  Chat: vi.fn(() => <div data-testid="chat" />),
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
    isParentAvailable: false,
    sendCommand: vi.fn(),
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
} satisfies ChatKitOptions;

describe('App', () => {
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
});
