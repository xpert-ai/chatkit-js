import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaseMessenger } from '@xpert-ai/chatkit-web-shared';
import { FrameSafeHttpError, HttpError } from '../../chatkit-web-shared/src/errors/HttpError';
import { FrameSafeIntegrationError } from '../../chatkit-web-shared/src/errors/IntegrationError';

class LoopbackMessenger extends BaseMessenger<
  { fail: () => void },
  { fail: () => void }
> {
  canReceiveCommand() {
    return true;
  }
}

const messengers: LoopbackMessenger[] = [];

function createMessenger(error: unknown) {
  // Exercise the real structured-clone boundary and the response handler, so a
  // serialization failure cannot silently leave the caller's promise pending.
  vi.spyOn(window, 'postMessage').mockImplementation((message) => {
    const cloned = structuredClone(message);
    queueMicrotask(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: cloned,
          origin: 'https://host.example',
          source: window,
        }),
      );
    });
  });
  const messenger = new LoopbackMessenger({
    target: () => window,
    targetOrigin: 'https://host.example',
    fetch: async () => {
      throw error;
    },
    handlers: {
      onFail: () => {
        throw error;
      },
    },
  });
  messenger.connect();
  messengers.push(messenger);
  return messenger;
}

afterEach(() => {
  messengers.splice(0).forEach((messenger) => messenger.destroy());
  vi.restoreAllMocks();
});

describe('messenger host errors', () => {
  const networkError = () => ({
    name: 'HttpErrorResponse',
    message: 'Http failure response: 0 Unknown Error',
    status: 0,
    statusText: 'Unknown Error',
    error: new ProgressEvent('error'),
    // Node and browsers differ in which DOM objects they can clone. A callback
    // makes this host error non-cloneable in both environments.
    request: { onerror: () => {} },
  });

  it('rejects a bridged fetch with its HTTP status when host state cannot be cloned', async () => {
    const messenger = createMessenger(networkError());
    await expect(messenger.fetch('/api/test', {})).rejects.toMatchObject({
      name: 'HttpError',
      message: 'Http failure response: 0 Unknown Error',
      status: 0,
      statusText: 'Unknown Error',
    });
  });

  it('settles a failed streaming request with non-cloneable host state', async () => {
    const messenger = createMessenger(networkError());
    await expect(
      messenger.fetchEventSource('/api/test', { openWhenHidden: true }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('settles a failed command without forwarding an uncloneable cause', async () => {
    const messenger = createMessenger({
      message: 'Command failed',
      cause: () => {},
    });
    await expect(messenger.commands.fail()).rejects.toThrow('Command failed');
  });

  it('preserves frame-safe integration errors', async () => {
    const messenger = createMessenger(
      new FrameSafeIntegrationError('Unsupported command'),
    );
    await expect(messenger.commands.fail()).rejects.toMatchObject({
      name: 'IntegrationError',
      message: 'Unsupported command',
    });
  });

  it('preserves HTTP metadata for cloneable errors', async () => {
    const messenger = createMessenger(
      new FrameSafeHttpError('Forbidden', { status: 403 }, { requestId: 'request-1' }),
    );
    await expect(messenger.fetch('/api/test', {})).rejects.toMatchObject({
      status: 403,
      metadata: { requestId: 'request-1' },
    });
  });
});
