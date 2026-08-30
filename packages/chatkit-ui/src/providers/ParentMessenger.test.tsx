import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isTrustedChatKitMessageEvent } from '@xpert-ai/chatkit-web-shared';

const mocks = vi.hoisted(() => ({
  stream: {
    isLoading: false,
    selectedModelId: null as string | null,
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

function RuntimeCapabilitiesProbe({
  onSetRuntimeCapabilities,
}: {
  onSetRuntimeCapabilities?: (selection: unknown) => void;
}) {
  useParentMessenger({ onSetRuntimeCapabilities });
  return null;
}

function ComposerValueProbe({
  onSetComposerValue,
}: {
  onSetComposerValue: (payload: unknown) => void;
}) {
  useParentMessenger({ onSetComposerValue });
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
    mocks.stream.selectedModelId = null;
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

  it('does not let a matching channel bypass the expected origin', () => {
    const event = new MessageEvent('message', {
      data: {
        __xpaiChatKit: true,
        channelId: 'matching-channel',
      },
      origin: 'https://untrusted.example.com',
    });
    Object.defineProperty(event, 'source', {
      configurable: true,
      value: { postMessage: vi.fn() },
    });

    expect(
      isTrustedChatKitMessageEvent(event, {
        channelId: 'matching-channel',
        expectedOrigin: 'https://trusted.example.com',
        expectedSource: window,
      }),
    ).toBe(false);
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

  it('uses an explicit model and otherwise carries the composer selection', async () => {
    render(
      <ParentMessengerProvider>
        <div />
      </ParentMessengerProvider>,
    );

    const dispatch = (nonce: string, model?: string) => {
      const event = new MessageEvent('message', {
        data: {
          __xpaiChatKit: true,
          type: 'command',
          command: 'onSendUserMessage',
          nonce,
          data: { text: nonce, ...(model ? { model } : {}) },
        },
        origin: 'https://example.com',
      });
      Object.defineProperty(event, 'source', {
        configurable: true,
        value: parentWindow,
      });
      window.dispatchEvent(event);
    };

    dispatch('explicit-model', 'mdl_explicit');
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.submit.mock.calls[0]?.[0]).toMatchObject({
      input: { input: 'explicit-model', model: 'mdl_explicit' },
    });

    mocks.stream.selectedModelId = 'mdl_default';
    dispatch('selected-model');
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(2));
    expect(mocks.stream.submit.mock.calls[1]?.[0]).toMatchObject({
      input: { input: 'selected-model', model: 'mdl_default' },
    });
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

  it('dispatches setRuntimeCapabilities commands to registered handlers', async () => {
    const onSetRuntimeCapabilities = vi.fn();
    const runtimeCapabilities = {
      mode: 'allowlist' as const,
      skills: { workspaceId: 'workspace-1', ids: ['skill-1'] },
      plugins: { nodeKeys: [] },
      subAgents: { nodeKeys: [] },
    };

    render(
      <ParentMessengerProvider>
        <RuntimeCapabilitiesProbe
          onSetRuntimeCapabilities={onSetRuntimeCapabilities}
        />
      </ParentMessengerProvider>,
    );

    const event = new MessageEvent('message', {
      data: {
        __xpaiChatKit: true,
        type: 'command',
        command: 'onSetRuntimeCapabilities',
        nonce: 'runtime-capabilities-command-test',
        data: runtimeCapabilities,
      },
      origin: 'https://example.com',
    });
    Object.defineProperty(event, 'source', {
      configurable: true,
      value: parentWindow,
    });

    window.dispatchEvent(event);

    await waitFor(() =>
      expect(onSetRuntimeCapabilities).toHaveBeenCalledWith(
        runtimeCapabilities,
      ),
    );
    expect(parentWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        __xpaiChatKit: true,
        type: 'response',
        nonce: 'runtime-capabilities-command-test',
        response: { ok: true },
      }),
      '*',
    );
  });

  it('dispatches setComposerValue runtime capability insert payloads to registered handlers', async () => {
    const onSetComposerValue = vi.fn();
    const runtimeCapabilities = {
      mode: 'allowlist' as const,
      skills: { workspaceId: 'workspace-1', ids: ['skill-1'] },
      plugins: { nodeKeys: [] },
      subAgents: { nodeKeys: [] },
    };

    render(
      <ParentMessengerProvider>
        <ComposerValueProbe onSetComposerValue={onSetComposerValue} />
      </ParentMessengerProvider>,
    );

    const event = new MessageEvent('message', {
      data: {
        __xpaiChatKit: true,
        type: 'command',
        command: 'onSetComposerValue',
        nonce: 'runtime-capabilities-insert-command-test',
        data: {
          runtimeCapabilities,
          insertRuntimeCapabilities: true,
        },
      },
      origin: 'https://example.com',
    });
    Object.defineProperty(event, 'source', {
      configurable: true,
      value: parentWindow,
    });

    window.dispatchEvent(event);

    await waitFor(() =>
      expect(onSetComposerValue).toHaveBeenCalledWith({
        runtimeCapabilities,
        insertRuntimeCapabilities: true,
      }),
    );
    expect(parentWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        __xpaiChatKit: true,
        type: 'response',
        nonce: 'runtime-capabilities-insert-command-test',
        response: { ok: true },
      }),
      '*',
    );
  });

  it('accepts a matching channel when a WebView exposes a different parent source proxy', async () => {
    const onSetComposerValue = vi.fn();
    render(
      <ParentMessengerProvider channelId="dingtalk-channel">
        <ComposerValueProbe onSetComposerValue={onSetComposerValue} />
      </ParentMessengerProvider>,
    );

    const data = {
      __xpaiChatKit: true,
      channelId: 'dingtalk-channel',
      type: 'command',
      command: 'onSetComposerValue',
      nonce: 'dingtalk-source-proxy-test',
      data: {
        text: 'Bridge restored',
      },
    };
    const event = new MessageEvent('message', {
      data,
      origin: 'https://example.com',
    });
    Object.defineProperty(event, 'source', {
      configurable: true,
      value: { postMessage: vi.fn() },
    });

    window.dispatchEvent(event);

    await waitFor(() =>
      expect(onSetComposerValue).toHaveBeenCalledWith({
        text: 'Bridge restored',
      }),
    );
    expect(parentWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        __xpaiChatKit: true,
        channelId: 'dingtalk-channel',
        type: 'response',
        nonce: 'dingtalk-source-proxy-test',
        response: { ok: true },
      }),
      '*',
    );
  });

  it('rejects an incorrect channel when the parent source also differs', async () => {
    const onSetComposerValue = vi.fn();
    render(
      <ParentMessengerProvider channelId="expected-channel">
        <ComposerValueProbe onSetComposerValue={onSetComposerValue} />
      </ParentMessengerProvider>,
    );

    const event = new MessageEvent('message', {
      data: {
        __xpaiChatKit: true,
        channelId: 'wrong-channel',
        type: 'command',
        command: 'onSetComposerValue',
        nonce: 'wrong-channel-test',
        data: {
          text: 'Do not accept this',
        },
      },
      origin: 'https://example.com',
    });
    Object.defineProperty(event, 'source', {
      configurable: true,
      value: { postMessage: vi.fn() },
    });

    window.dispatchEvent(event);
    await Promise.resolve();

    expect(onSetComposerValue).not.toHaveBeenCalled();
    expect(parentWindow.postMessage).not.toHaveBeenCalled();
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
