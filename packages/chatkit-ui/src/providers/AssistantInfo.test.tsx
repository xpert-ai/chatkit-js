import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client, type Assistant } from '@xpert-ai/xpert-sdk';
import { useAssistantInfo } from '../hooks/useAssistantInfo';
import type { StateType, StreamContextType } from './Stream';
import { AssistantInfoProvider } from './AssistantInfo';

let stream: Pick<
  StreamContextType,
  'client' | 'assistantId' | 'apiUrl' | 'apiKey' | 'organizationId'
>;
const renders: Array<Assistant | undefined> = [];
vi.mock('./Stream', () => ({ useStreamContext: () => stream }));
const host = vi.hoisted(() => ({ updates: new Set<() => void>() }));
vi.mock('./ParentMessenger', async () => {
  const { createContext } = await import('react');
  return {
    ParentMessengerContext: createContext({
      registerOnSetOptions: (handler: () => void) => {
        host.updates.add(handler);
        return () => host.updates.delete(handler);
      },
    }),
  };
});

function refreshFromHost() {
  act(() => host.updates.forEach((handler) => handler()));
}

function profile(id = 'bid'): Assistant {
  const config = {
    configurable: {},
    options: { messagePresentation: { mode: 'bubbles' } },
  };
  return {
    assistant_id: id,
    graph_id: id,
    name: `Assistant ${id}`,
    version: 1,
    context: null,
    created_at: '',
    updated_at: '',
    metadata: { avatar: { type: 'url', url: `/avatars/${id}.png` } },
    config,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function ChatProbe() {
  const assistant = useAssistantInfo(
    stream.apiKey ? stream.client : null,
    stream.assistantId,
  );
  renders.push(assistant);
  return <span>{assistant?.name ?? 'loading'}</span>;
}

function session(project: string) {
  return (
    <AssistantInfoProvider>
      <ChatProbe key={project} />
    </AssistantInfoProvider>
  );
}

beforeEach(() => {
  stream = {
    client: new Client<StateType>({ apiUrl: 'https://api.example.test' }),
    apiUrl: 'https://api.example.test',
    apiKey: 'secret',
    assistantId: 'bid',
    organizationId: 'org-1',
  };
  renders.length = 0;
});
afterEach(() => vi.restoreAllMocks());

describe('Assistant identity across project lifecycles', () => {
  it('keeps the full profile synchronously when Chat remounts without another request', async () => {
    const assistant = profile();
    const get = vi
      .spyOn(stream.client.assistants, 'get')
      .mockResolvedValue(assistant);
    const { rerender } = render(session('existing-project'));
    await screen.findByText(assistant.name!);
    renders.length = 0;

    for (const project of [
      'new-project:1',
      'new-project:2',
      'another-project',
    ]) {
      rerender(session(project));
      fireEvent.focus(window);
      expect(screen.getByText(assistant.name!)).toBeVisible();
    }
    expect(renders.length).toBeGreaterThan(0);
    expect(renders.every((value) => value === assistant)).toBe(true);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('keeps the in-flight request when Chat remounts before the profile arrives', async () => {
    const pending = deferred<Assistant>();
    const get = vi
      .spyOn(stream.client.assistants, 'get')
      .mockReturnValue(pending.promise);
    const { rerender } = render(session('existing-project'));
    rerender(session('new-project'));
    await act(async () => pending.resolve(profile()));
    expect(screen.getByText('Assistant bid')).toBeVisible();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it.each(['assistant', 'organization', 'api'] as const)(
    'loads a new profile when the %s scope changes and ignores a late old refresh',
    async (scope) => {
      const oldRefresh = deferred<Assistant>();
      const oldGet = vi
        .spyOn(stream.client.assistants, 'get')
        .mockResolvedValueOnce(profile())
        .mockReturnValueOnce(oldRefresh.promise);
      const { rerender } = render(session('project-1'));
      await screen.findByText('Assistant bid');
      refreshFromHost();
      expect(oldGet).toHaveBeenCalledTimes(2);

      const pending = deferred<Assistant>();
      let get = oldGet;
      if (scope === 'assistant') {
        stream = { ...stream, assistantId: 'other' };
        get.mockReturnValueOnce(pending.promise);
      } else {
        // StreamProvider replaces its client/session for organization or API changes.
        const apiUrl =
          scope === 'api' ? 'https://other.example.test' : stream.apiUrl;
        stream = {
          ...stream,
          organizationId:
            scope === 'organization' ? 'org-2' : stream.organizationId,
          apiUrl,
          client: new Client<StateType>({ apiUrl }),
        };
        get = vi
          .spyOn(stream.client.assistants, 'get')
          .mockReturnValue(pending.promise);
      }
      rerender(session('project-1'));
      expect(screen.getByText('loading')).toBeVisible();
      await act(async () => oldRefresh.resolve(profile('stale')));
      expect(screen.getByText('loading')).toBeVisible();
      await act(async () => pending.resolve(profile('other')));
      expect(screen.getByText('Assistant other')).toBeVisible();
      expect(get).toHaveBeenLastCalledWith(stream.assistantId);
    },
  );

  it('preserves the profile during a background refresh and when that refresh fails', async () => {
    const refresh = deferred<Assistant>();
    vi.spyOn(stream.client.assistants, 'get')
      .mockResolvedValueOnce(profile())
      .mockReturnValueOnce(refresh.promise);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(session('project'));
    await screen.findByText('Assistant bid');
    renders.length = 0;
    refreshFromHost();
    expect(screen.getByText('Assistant bid')).toBeVisible();
    await act(async () => refresh.reject(new Error('temporary outage')));
    expect(screen.getByText('Assistant bid')).toBeVisible();
    expect(renders.every((value) => value?.assistant_id === 'bid')).toBe(true);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('discards the profile on sign-out and waits for credentials before loading it again', async () => {
    const get = vi
      .spyOn(stream.client.assistants, 'get')
      .mockResolvedValue(profile());
    const { rerender } = render(session('project'));
    await screen.findByText('Assistant bid');
    stream = { ...stream, apiKey: '' };
    rerender(session('project'));
    expect(screen.getByText('loading')).toBeVisible();
    fireEvent.focus(window);
    expect(get).toHaveBeenCalledTimes(1);
    stream = { ...stream, apiKey: 'new-secret' };
    rerender(session('project'));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Assistant bid')).toBeVisible();
  });
});
