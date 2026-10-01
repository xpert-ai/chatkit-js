import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import {
  decodeBase64,
  type ChatKitFrameParams,
} from '@xpert-ai/chatkit-web-shared';

const bridge = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock('./ChatFrameMessenger', () => ({
  ChatFrameMessenger: class {
    commands = { setOptions: bridge.update };
    on() {}
    connect() {}
    disconnect() {}
    setTargetOrigin() {}
  },
}));
import { registerChatKitElement, ChatKitElement } from './ChatKitElement';
registerChatKitElement();
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('message presentation options bridge', () => {
  it('serializes initial options and forwards runtime mode changes without replacing the frame', async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const element = document.createElement('xpertai-chatkit') as ChatKitElement;
    const options: ChatKitOptions = {
      frameUrl: 'http://localhost:5173',
      api: {
        apiUrl: 'https://example.org/api/ai',
        getClientSecret: async () => 'test-only',
      },
      messagePresentation: { mode: 'bubbles', collapseProcess: true },
    };
    element.setOptions(options);
    document.body.append(element);
    const frame = element.shadowRoot?.querySelector('iframe');
    expect(frame).toBeTruthy();
    const params = decodeBase64<ChatKitFrameParams>(
      new URL(frame!.src).hash.slice(1),
    );
    expect(params.options.messagePresentation).toEqual({
      mode: 'bubbles',
      collapseProcess: true,
    });
    frame!.dispatchEvent(new Event('load'));
    element.setOptions({
      ...options,
      messagePresentation: { mode: 'transcript', collapseProcess: true },
    });
    await Promise.resolve();
    expect(bridge.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        messagePresentation: { mode: 'transcript', collapseProcess: true },
      }),
    );
    expect(element.shadowRoot?.querySelector('iframe')).toBe(frame);
    element.remove();
  });
});
