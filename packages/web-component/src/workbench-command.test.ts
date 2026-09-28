import { describe, expect, it, vi } from 'vitest';
import type { ChatKitWorkbenchClientCommandRequest } from '@xpert-ai/chatkit-types';
const bridge = vi.hoisted(() => ({
  handlers: {} as {
    onWorkbenchClientCommand: (
      request: ChatKitWorkbenchClientCommandRequest,
    ) => Promise<unknown>;
  },
}));
vi.mock('./ChatFrameMessenger', () => ({
  ChatFrameMessenger: class {
    constructor(options: { handlers: typeof bridge.handlers }) {
      bridge.handlers = options.handlers;
    }
    disconnect() {}
  },
}));
import { registerChatKitElement, ChatKitElement } from './ChatKitElement';
registerChatKitElement();
const request: ChatKitWorkbenchClientCommandRequest = {
  commandKey: 'workbench.navigation.open',
  payload: { target: 'unknown' },
  hostType: 'agent',
  hostId: 'assistant',
  viewKey: 'view',
};

describe('Workbench host bridge', () => {
  it('returns unsupported without emitting a global ChatKit error when no handler is registered', async () => {
    const element = document.createElement('xpertai-chatkit');
    const onError = vi.fn();
    element.addEventListener('chatkit.error', onError);
    expect(await bridge.handlers.onWorkbenchClientCommand(request)).toEqual({
      success: false,
      code: 'unsupported',
      commandKey: request.commandKey,
    });
    expect(onError).not.toHaveBeenCalled();
  });
  it('passes a registered host result back to the ChatKit frame', async () => {
    const element = document.createElement('xpertai-chatkit') as ChatKitElement;
    const onClientCommand = vi
      .fn()
      .mockResolvedValue({ success: true, status: 'opened' });
    element.setOptions({
      api: {
        apiUrl: 'https://example.org/api/ai',
        getClientSecret: async () => 'secret',
      },
      workbench: { onClientCommand },
    });
    expect(await bridge.handlers.onWorkbenchClientCommand(request)).toEqual({
      success: true,
      status: 'opened',
    });
    expect(onClientCommand).toHaveBeenCalledWith(request);
  });
});
