import { describe, expect, it, vi } from 'vitest';

import {
  createNativeRunnerBridge,
  type ChromeRuntimePort,
} from './native-runner';

function createPort() {
  const messageListeners: Array<(message: unknown) => void> = [];
  const disconnectListeners: Array<() => void> = [];
  const port: ChromeRuntimePort = {
    postMessage: vi.fn(),
    disconnect: vi.fn(),
    onMessage: {
      addListener: vi.fn((listener) => messageListeners.push(listener)),
    },
    onDisconnect: {
      addListener: vi.fn((listener) => disconnectListeners.push(listener)),
    },
  };
  return { port, messageListeners, disconnectListeners };
}

describe('native browser runner bridge', () => {
  it('keeps one native port and correlates runner responses', async () => {
    const native = createPort();
    const connectNative = vi.fn(() => native.port);
    const bridge = createNativeRunnerBridge(connectNative);

    const responsePromise = bridge.request({
      command: 'start',
      startUrl: 'https://example.com',
    });
    const request = vi.mocked(native.port.postMessage).mock.calls[0]?.[0] as {
      requestId: string;
    };
    native.messageListeners[0]?.({
      requestId: request.requestId,
      ok: true,
      status: { state: 'running', sessionId: 'session-1' },
    });

    await expect(responsePromise).resolves.toMatchObject({
      ok: true,
      status: { state: 'running', sessionId: 'session-1' },
    });
    expect(connectNative).toHaveBeenCalledOnce();
    expect(connectNative).toHaveBeenCalledWith(
      'ai.xpert.chatkit.browser_runner',
    );
  });

  it('rejects pending requests when the native host disconnects', async () => {
    const native = createPort();
    const bridge = createNativeRunnerBridge(() => native.port);
    const responsePromise = bridge.request({ command: 'status' });

    native.disconnectListeners[0]?.();

    await expect(responsePromise).rejects.toThrow('disconnected');
  });
});
