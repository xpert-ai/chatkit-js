import * as React from 'react';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Client, type RuntimeResourceAuthorization } from '@xpert-ai/xpert-sdk';
import { ThemeProvider } from '../../providers/Theme';
import { ParentMessengerContext } from '../../providers/ParentMessenger';
import { ConnectionAuthorizationDialog } from './ConnectionAuthorizationDialog';
vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({ t: (key: string) => key }),
}));
const requirement = (canManage = true): RuntimeResourceAuthorization => ({
  type: 'connector',
  status: 'requires_auth',
  connector: {
    bindingId: 'binding',
    provider: 'provider',
    scope: { type: 'workspace', workspaceId: 'workspace' },
    canManage,
    authorizationMode: 'shared',
  },
});
function setup(canManage = true, strict = false, useBridge = false) {
  const client = new Client({ apiUrl: 'https://example.test/api/ai' });
  const status = vi
    .spyOn(client.connectors, 'runtimeStatus')
    .mockResolvedValue({
      bindingId: 'binding',
      status: 'active',
      granted: true,
    });
  const consent = vi.spyOn(client.connectors, 'consent');
  const directConnect = vi.spyOn(client.connectors, 'connect');
  const done = vi.fn().mockResolvedValue(undefined);
  const close = vi.fn();
  const connect = vi.fn().mockResolvedValue({ status: 'connected' });
  const prepare = vi.fn().mockResolvedValue(requirement(canManage));
  const sendCommand = vi.fn().mockResolvedValue({ status: 'connected' });
  const register = vi.fn(() => vi.fn());
  // removeMethods serializes host callbacks as markers before sending options to the iframe.
  const serializedOptions: ChatKitOptions = JSON.parse(
    '{"composer":{"resources":{"onConnect":"[ChatKitMethod]"}}}',
  );
  const content = (
    <ParentMessengerContext.Provider
      value={{
        isParentAvailable: true,
        sendCommand,
        sendEvent: vi.fn(),
        registerOnSetOptions: register,
        registerOnSetPetEnabled: register,
        registerOnSetComposerValue: register,
        registerOnSetRuntimeCapabilities: register,
        registerOnFocusComposer: register,
      }}
    >
      <ThemeProvider>
        <ConnectionAuthorizationDialog
          inline
          client={client}
          assistantId="assistant"
          target={{
            key: 'binding',
            title: 'Example',
            prepare,
            onAuthorized: done,
          }}
          onConnect={
            useBridge
              ? serializedOptions.composer?.resources?.onConnect
              : connect
          }
          onClose={close}
        />
      </ThemeProvider>
    </ParentMessengerContext.Provider>
  );
  return {
    ...render(
      strict ? <React.StrictMode>{content}</React.StrictMode> : content,
    ),
    status,
    consent,
    directConnect,
    done,
    close,
    connect,
    prepare,
    sendCommand,
  };
}
async function connectButton() {
  return screen.findByRole('button', { name: 'composer.resources.connect' });
}
describe('workspace connection authorization', () => {
  it('opens the host flow directly and verifies readiness without personal OAuth or credentials in the command', async () => {
    const { connect, status, done, consent, directConnect, close } = setup();
    fireEvent.click(await connectButton());
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(connect).toHaveBeenCalledWith({
      assistantId: 'assistant',
      bindingId: 'binding',
    });
    expect(status).toHaveBeenCalledWith('assistant', 'binding', {
      signal: expect.any(AbortSignal),
    });
    expect(consent).not.toHaveBeenCalled();
    expect(directConnect).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
  it('uses the parent command when the iframe has no callable host options', async () => {
    const { sendCommand, connect, done } = setup(true, false, true);
    fireEvent.click(await connectButton());
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(sendCommand).toHaveBeenCalledWith('onConnectWorkspaceConnector', {
      assistantId: 'assistant',
      bindingId: 'binding',
    });
    expect(connect).not.toHaveBeenCalled();
  });
  it('shows only the administrator guidance to users without workspace management permission', async () => {
    const { connect, status } = setup(false);
    expect(
      await screen.findByText('composer.connections.contactAdmin'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'composer.resources.connect' }),
    ).not.toBeInTheDocument();
    expect(connect).not.toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });
  it('rechecks a permission revoked after opening the panel', async () => {
    const { prepare, connect } = setup();
    const button = await connectButton();
    prepare.mockResolvedValue(requirement(false));
    fireEvent.click(button);
    expect(
      await screen.findByText('composer.connections.contactAdmin'),
    ).toBeInTheDocument();
    expect(connect).not.toHaveBeenCalled();
  });
  it('starts only one host flow under StrictMode and repeated clicks', async () => {
    const { connect, done } = setup(true, true);
    const button = await connectButton();
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(connect).toHaveBeenCalledOnce();
  });
  it('keeps the selection unchanged when the host flow is cancelled', async () => {
    const { connect, status, done } = setup();
    connect.mockResolvedValue({ status: 'cancelled' });
    fireEvent.click(await connectButton());
    await waitFor(() => expect(connect).toHaveBeenCalledOnce());
    expect(status).not.toHaveBeenCalled();
    expect(done).not.toHaveBeenCalled();
  });
  it('does not trust a host success response when the workspace connection is not ready', async () => {
    const { status, done } = setup();
    status.mockResolvedValue({
      bindingId: 'binding',
      status: 'disconnected',
      granted: false,
    });
    fireEvent.click(await connectButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'composer.connections.notReady',
    );
    expect(done).not.toHaveBeenCalled();
  });
  it('ignores a host response after switching away from the conversation', async () => {
    const { connect, status, done, unmount } = setup();
    let finish!: (result: { status: 'connected' }) => void;
    connect.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    fireEvent.click(await connectButton());
    await waitFor(() => expect(connect).toHaveBeenCalledOnce());
    unmount();
    await act(async () => finish({ status: 'connected' }));
    expect(status).not.toHaveBeenCalled();
    expect(done).not.toHaveBeenCalled();
  });
  it('retains the original selection on status errors', async () => {
    const { status, done } = setup();
    status.mockRejectedValue(
      Object.assign(new Error('expired'), { status: 401 }),
    );
    fireEvent.click(await connectButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'composer.connections.signInRequired',
    );
    expect(done).not.toHaveBeenCalled();
  });
});
