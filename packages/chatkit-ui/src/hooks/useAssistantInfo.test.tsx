import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Assistant, Client } from '@xpert-ai/xpert-sdk';
import { useAssistantInfo } from './useAssistantInfo';
import { readAssistantMessagePresentation } from '../lib/assistant-message-presentation';
import { resolveMessagePresentation } from '../lib/message-presentation';
import { ParentMessengerContext } from '../providers/ParentMessenger';

function profile(id: string, mode?: string): Assistant {
  const config = {
    configurable: {},
    options: { messagePresentation: { mode } },
  };
  return {
    assistant_id: id,
    graph_id: id,
    name: id,
    version: 1,
    context: null,
    created_at: '',
    updated_at: '',
    metadata: {},
    config,
  };
}

describe('Assistant presentation configuration', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reuses the profile across focus, visibility changes and idle time', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible');
    const get = vi.fn().mockResolvedValue(profile('a', 'bubbles'));
    const client = { assistants: { get } } as unknown as Pick<
      Client,
      'assistants'
    >;
    const { result } = renderHook(() => useAssistantInfo(client, 'a'));
    await act(async () => {});
    expect(result.current?.assistant_id).toBe('a');
    const loadedProfile = result.current;

    for (let cycle = 0; cycle < 3; cycle++) {
      await act(async () => window.dispatchEvent(new Event('focus')));
      visibility.mockReturnValue('hidden');
      await act(async () => document.dispatchEvent(new Event('visibilitychange')));
      visibility.mockReturnValue('visible');
      await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    }
    await act(async () => vi.advanceTimersByTime(180000));

    expect(get).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(loadedProfile);
  });

  it('revalidates published settings on a host update without clearing the current profile', async () => {
    let refresh: () => void = () => {};
    const context: NonNullable<
      React.ContextType<typeof ParentMessengerContext>
    > = {
      isParentAvailable: true,
      sendCommand: vi.fn(async () => undefined),
      sendEvent: vi.fn(),
      updateComposer: vi.fn(async () => {}),
      focusComposer: vi.fn(async () => {}),
      registerOnSetOptions: (handler) => {
        refresh = () => handler(null);
        return () => {
          refresh = () => {};
        };
      },
      registerOnSetPetEnabled: () => () => {},
      registerOnSetComposerValue: () => () => {},
      registerOnSetRuntimeCapabilities: () => () => {},
      registerOnFocusComposer: () => () => {},
    };
    let published: (assistant: Assistant) => void;
    const get = vi
      .fn()
      .mockResolvedValueOnce(profile('a', 'transcript'))
      .mockImplementationOnce(
        () =>
          new Promise<Assistant>((resolve) => {
            published = resolve;
          }),
      );
    const client = { assistants: { get } } as unknown as Pick<
      Client,
      'assistants'
    >;
    const { result, unmount } = renderHook(
      () => useAssistantInfo(client, 'a'),
      {
        wrapper: ({ children }) => (
          <ParentMessengerContext.Provider value={context}>
            {children}
          </ParentMessengerContext.Provider>
        ),
      },
    );
    await waitFor(() =>
      expect(
        readAssistantMessagePresentation(result.current?.config)?.mode,
      ).toBe('transcript'),
    );
    act(() => refresh());
    expect(readAssistantMessagePresentation(result.current?.config)?.mode).toBe(
      'transcript',
    );
    await act(async () => published(profile('a', 'bubbles')));
    expect(readAssistantMessagePresentation(result.current?.config)?.mode).toBe(
      'bubbles',
    );
    expect(get).toHaveBeenCalledTimes(2);
    unmount();
    act(() => refresh());
    expect(get).toHaveBeenCalledTimes(2);
  });
  it('validates only the documented published options field', () => {
    for (const input of [
      null,
      {},
      { options: null },
      { options: { messagePresentation: 'bubbles' } },
      profile('a', 'unknown').config,
      { messagePresentation: { mode: 'bubbles' } },
    ]) {
      expect(readAssistantMessagePresentation(input)).toBeUndefined();
    }
    expect(
      readAssistantMessagePresentation(profile('a', 'bubbles').config),
    ).toEqual({ mode: 'bubbles' });
    expect(
      readAssistantMessagePresentation(profile('a', 'transcript').config),
    ).toEqual({ mode: 'transcript' });
  });

  it('switches Assistant defaults without letting a previous request leak into the current conversation', async () => {
    const pending = new Map<string, (assistant: Assistant) => void>();
    const get = vi.fn(
      (id: string) =>
        new Promise<Assistant>((resolve) => pending.set(id, resolve)),
    );
    const client = { assistants: { get } } as unknown as Pick<
      Client,
      'assistants'
    >;
    const { result, rerender } = renderHook(
      ({ id }) => useAssistantInfo(client, id),
      { initialProps: { id: 'a' } },
    );
    rerender({ id: 'b' });
    await act(async () => pending.get('a')?.(profile('a', 'bubbles')));
    expect(result.current).toBeUndefined();
    await act(async () => pending.get('b')?.(profile('b', 'transcript')));
    await waitFor(() => expect(result.current?.assistant_id).toBe('b'));
    const defaults = readAssistantMessagePresentation(result.current?.config);
    expect(resolveMessagePresentation(undefined, defaults).mode).toBe(
      'transcript',
    );
    expect(resolveMessagePresentation({ mode: 'bubbles' }, defaults).mode).toBe(
      'bubbles',
    );
    rerender({ id: 'c' });
    expect(result.current).toBeUndefined();
  });
});
