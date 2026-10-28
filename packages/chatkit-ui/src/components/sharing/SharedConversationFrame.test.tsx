import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SharedConversationFrame } from './SharedConversationFrame';

vi.mock('./ReadonlyMessageList', () => ({
  ReadonlyMessageList: () => <div data-testid="transcript">Read only</div>,
}));
vi.mock('../../i18n', () => ({ setLanguage: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.location.hash = '';
});

describe('shared transcript frame lifecycle', () => {
  it('updates the mounted theme through the bound channel and clears expired content', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const parent = document.createElement('iframe');
    document.body.append(parent);
    const source = parent.contentWindow!;
    const postMessage = vi
      .spyOn(source, 'postMessage')
      .mockImplementation(() => {});
    vi.spyOn(window, 'parent', 'get').mockReturnValue(source);
    const channelId = crypto.randomUUID();
    const origin = 'https://xpert.example';
    window.location.hash = new URLSearchParams({
      channelId,
      parentOrigin: origin,
    }).toString();
    const view = render(<SharedConversationFrame />);
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'chatkit:shared-transcript-ready', channelId },
      origin,
    );
    const data = {
      type: 'chatkit:shared-transcript',
      channelId,
      locale: 'en-US',
      snapshot: {
        messages: [{ role: 'ai', text: 'Answer' }],
        expiresAt: new Date(Date.now() + 1000).toISOString(),
      },
      theme: { colorScheme: 'light', radius: 'sharp', density: 'compact' },
    };
    const publish = (payload: unknown) =>
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', { source, origin, data: payload }),
        );
      });
    publish(data);
    const root = screen.getByTestId('transcript').parentElement!.parentElement!;
    expect(root.style.getPropertyValue('--chat-panel-radius')).toBe('0px');
    expect(root.style.getPropertyValue('--chat-density-scale')).toBe('0.75');
    publish({
      ...data,
      theme: { colorScheme: 'dark', radius: 'round', density: 'spacious' },
    });
    expect(screen.getByTestId('transcript').parentElement!.parentElement).toBe(
      root,
    );
    expect(document.documentElement).toHaveClass('dark');
    expect(root.style.getPropertyValue('--chat-panel-radius')).toBe(
      'calc(var(--radius, 0.625rem) + 4px)',
    );
    expect(root.style.getPropertyValue('--chat-density-scale')).toBe('1.25');
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByTestId('transcript')).toBeNull();
    view.unmount();
    parent.remove();
  });
});
