import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  stream: {
    isLoading: false,
    followUpBehavior: 'queue',
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

describe('ParentMessengerProvider plan mode', () => {
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
});
