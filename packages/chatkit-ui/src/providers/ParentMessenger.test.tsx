import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  stream: {
    isLoading: false,
    submit: vi.fn(),
  },
}));

vi.mock('../hooks/useStream', () => ({
  useStreamManager: () => ({
    streamRef: {
      current: mocks.stream,
    },
  }),
}));

import { ParentMessengerProvider } from './ParentMessenger';
import { useParentMessenger } from '../hooks/useParentMessenger';

function PetEnabledProbe({
  onSetPetEnabled,
}: {
  onSetPetEnabled: (enabled: boolean) => void;
}) {
  useParentMessenger({ onSetPetEnabled });
  return null;
}

function ChatMinimizeEventProbe() {
  const parentMessenger = useParentMessenger();

  React.useEffect(() => {
    parentMessenger.sendEvent('chat_minimize_change', { minimized: true });
  }, [parentMessenger]);

  return null;
}

describe('ParentMessengerProvider', () => {
  let originalParent: Window['parent'];
  let parentWindow: { postMessage: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mocks.stream.submit.mockClear();
    mocks.stream.isLoading = false;
    parentWindow = {
      postMessage: vi.fn(),
    };
    originalParent = window.parent;
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: parentWindow,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: originalParent,
    });
  });

  it('passes planMode through sendUserMessage input and state', async () => {
    render(
      <ParentMessengerProvider>
        <div />
      </ParentMessengerProvider>,
    );

    const event = new MessageEvent('message', {
      data: {
        __xpaiChatKit: true,
        type: 'command',
        command: 'onSendUserMessage',
        nonce: 'plan-mode-test',
        data: {
          text: 'Plan this change',
          planMode: true,
        },
      },
      origin: 'https://example.com',
    });
    Object.defineProperty(event, 'source', {
      configurable: true,
      value: parentWindow,
    });

    window.dispatchEvent(event);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          input: 'Plan this change',
          planMode: true,
        },
        state: {
          human: {
            input: 'Plan this change',
            planMode: true,
          },
        },
      }),
      expect.any(Object),
    );
  });

  it('passes runtimeCapabilities through sendUserMessage input and state', async () => {
    render(
      <ParentMessengerProvider>
        <div />
      </ParentMessengerProvider>,
    );

    const runtimeCapabilities = {
      mode: 'allowlist' as const,
      skills: { workspaceId: 'workspace-1', ids: ['skill-1'] },
      plugins: { nodeKeys: ['middleware-1'] },
    };
    const event = new MessageEvent('message', {
      data: {
        __xpaiChatKit: true,
        type: 'command',
        command: 'onSendUserMessage',
        nonce: 'runtime-capabilities-test',
        data: {
          text: 'Use this capability',
          runtimeCapabilities,
        },
      },
      origin: 'https://example.com',
    });
    Object.defineProperty(event, 'source', {
      configurable: true,
      value: parentWindow,
    });

    window.dispatchEvent(event);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          input: 'Use this capability',
          runtimeCapabilities,
        },
        state: {
          human: {
            input: 'Use this capability',
            runtimeCapabilities,
          },
        },
      }),
      expect.any(Object),
    );
  });

  it('queues parent sendUserMessage commands while the stream is loading', async () => {
    mocks.stream.isLoading = true;

    render(
      <ParentMessengerProvider>
        <div />
      </ParentMessengerProvider>,
    );

    const event = new MessageEvent('message', {
      data: {
        __xpaiChatKit: true,
        type: 'command',
        command: 'onSendUserMessage',
        nonce: 'queued-follow-up-test',
        data: {
          text: 'Send after the current run',
        },
      },
      origin: 'https://example.com',
    });
    Object.defineProperty(event, 'source', {
      configurable: true,
      value: parentWindow,
    });

    window.dispatchEvent(event);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    const [, submitOptions] = mocks.stream.submit.mock.calls[0];
    expect(submitOptions).toMatchObject({
      followUpMode: 'queue',
    });
    expect(submitOptions).not.toHaveProperty('optimisticValues');
  });

  it('dispatches setPetEnabled commands to registered handlers', async () => {
    const onSetPetEnabled = vi.fn();
    render(
      <ParentMessengerProvider>
        <PetEnabledProbe onSetPetEnabled={onSetPetEnabled} />
      </ParentMessengerProvider>,
    );

    const event = new MessageEvent('message', {
      data: {
        __xpaiChatKit: true,
        type: 'command',
        command: 'onSetPetEnabled',
        nonce: 'pet-enabled-test',
        data: {
          enabled: false,
        },
      },
      origin: 'https://example.com',
    });
    Object.defineProperty(event, 'source', {
      configurable: true,
      value: parentWindow,
    });

    window.dispatchEvent(event);

    await waitFor(() => expect(onSetPetEnabled).toHaveBeenCalledWith(false));
    expect(parentWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        __xpaiChatKit: true,
        type: 'response',
        nonce: 'pet-enabled-test',
        response: { ok: true },
      }),
      '*',
    );
  });

  it('sends chat minimize events to the parent frame', () => {
    render(
      <ParentMessengerProvider>
        <ChatMinimizeEventProbe />
      </ParentMessengerProvider>,
    );

    expect(parentWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        __xpaiChatKit: true,
        type: 'event',
        event: 'chat_minimize_change',
        data: { minimized: true },
      }),
      '*',
      undefined,
    );
  });
});
