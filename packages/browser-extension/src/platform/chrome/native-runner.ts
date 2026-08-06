export const BROWSER_RUNNER_NATIVE_HOST = 'ai.xpert.chatkit.browser_runner';

export type BrowserRunnerStatus = {
  state: 'stopped' | 'starting' | 'running' | 'paused' | 'error';
  sessionId?: string;
  invalidatedPageStateId?: string;
  error?: string;
};

export type NativeRunnerRequest = {
  command: 'status' | 'start' | 'stop' | 'execute';
  startUrl?: string;
  call?: Record<string, unknown>;
};

export type NativeRunnerResponse = {
  requestId: string;
  ok: boolean;
  status?: BrowserRunnerStatus;
  result?: unknown;
  error?: string;
};

export type ChromeRuntimePort = {
  postMessage: (message: Record<string, unknown>) => void;
  disconnect: () => void;
  onMessage: {
    addListener: (listener: (message: unknown) => void) => void;
  };
  onDisconnect: {
    addListener: (listener: () => void) => void;
  };
};

export function createNativeRunnerBridge(
  connectNative: (application: string) => ChromeRuntimePort,
) {
  let port: ChromeRuntimePort | undefined;
  const pending = new Map<
    string,
    {
      resolve: (response: NativeRunnerResponse) => void;
      reject: (error: Error) => void;
      timeoutId: ReturnType<typeof setTimeout>;
    }
  >();

  const rejectPending = (message: string) => {
    for (const request of pending.values()) {
      clearTimeout(request.timeoutId);
      request.reject(new Error(message));
    }
    pending.clear();
  };

  const ensurePort = () => {
    if (port) return port;
    const nextPort = connectNative(BROWSER_RUNNER_NATIVE_HOST);
    nextPort.onMessage.addListener((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return;
      const requestId = Reflect.get(value, 'requestId');
      if (typeof requestId !== 'string') return;
      const request = pending.get(requestId);
      if (!request) return;
      pending.delete(requestId);
      clearTimeout(request.timeoutId);
      request.resolve(value as NativeRunnerResponse);
    });
    nextPort.onDisconnect.addListener(() => {
      if (port === nextPort) port = undefined;
      rejectPending('The browser runner native host disconnected.');
    });
    port = nextPort;
    return nextPort;
  };

  return {
    request(request: NativeRunnerRequest): Promise<NativeRunnerResponse> {
      const requestId = crypto.randomUUID();
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(
          () => {
            pending.delete(requestId);
            reject(new Error('The browser runner native host timed out.'));
          },
          request.command === 'start' ? 120_000 : 30_000,
        );
        pending.set(requestId, { resolve, reject, timeoutId });
        try {
          ensurePort().postMessage({ requestId, ...request });
        } catch (error) {
          pending.delete(requestId);
          clearTimeout(timeoutId);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    },
    disconnect() {
      port?.disconnect();
      port = undefined;
      rejectPending('The browser runner native host disconnected.');
    },
  };
}
