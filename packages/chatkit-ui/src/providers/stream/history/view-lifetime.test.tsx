import * as React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  setupHistoryTests,
  StreamProvider,
  useTestStream,
  stream,
} from '../testing/history-fixture';

describe('Assistant View lifetime across chat scopes', () => {
  setupHistoryTests();

  it('preserves views through credential initialization and rotation, but clears them on sign-out', async () => {
    const unmount = vi.fn();
    function View() {
      useTestStream();
      React.useEffect(() => unmount, []);
      return <iframe title="credential-view" />;
    }
    const tree = (apiKey: string) => (
      <StreamProvider
        apiKey={apiKey}
        apiUrl="https://api.example.test/api/ai"
        xpertId="assistant-1"
        threadStateMode="memory"
      >
        <View />
      </StreamProvider>
    );
    const { rerender, getByTitle } = render(tree(''));
    const iframe = getByTitle('credential-view');
    const loadThread = stream.loadThread;

    rerender(tree('cs-x-first'));
    await act(async () => loadThread('thread-1'));
    expect(stream.messages).toHaveLength(2);
    rerender(tree('cs-x-rotated'));
    expect(stream.apiKey).toBe('cs-x-rotated');
    expect(stream.conversationId).toBe('conversation-thread-1');
    expect(getByTitle('credential-view')).toBe(iframe);
    expect(unmount).not.toHaveBeenCalled();

    rerender(tree(''));
    expect(stream.apiKey).toBe('');
    expect(stream.messages).toHaveLength(0);
    expect(stream.conversationId).toBeNull();
    expect(getByTitle('credential-view')).not.toBe(iframe);
    expect(unmount).toHaveBeenCalledOnce();

    const signedOutView = getByTitle('credential-view');
    rerender(tree('cs-x-next-session'));
    expect(getByTitle('credential-view')).toBe(signedOutView);
    expect(stream.messages).toHaveLength(0);
  });

  it('replaces the session when the organization changes', async () => {
    function View() {
      useTestStream();
      return <iframe title="organization-view" />;
    }
    const tree = (organizationId: string) => (
      <StreamProvider
        apiKey="cs-x-test"
        apiUrl="https://api.example.test/api/ai"
        organizationId={organizationId}
        xpertId="assistant-1"
        threadStateMode="memory"
      >
        <View />
      </StreamProvider>
    );
    const { rerender, getByTitle } = render(tree('organization-1'));
    const iframe = getByTitle('organization-view');
    await act(async () => stream.loadThread('thread-1'));
    expect(stream.messages).toHaveLength(2);

    rerender(tree('organization-2'));
    expect(stream.organizationId).toBe('organization-2');
    expect(stream.messages).toHaveLength(0);
    expect(stream.conversationId).toBeNull();
    expect(getByTitle('organization-view')).not.toBe(iframe);
  });

  it('retains children while resetting project and navigation state, and remounts for a different Assistant', async () => {
    const unmount = vi.fn();
    function View() {
      useTestStream();
      React.useEffect(() => unmount, []);
      return <iframe title="persistent-view" />;
    }
    const tree = (
      projectId: string,
      initialThread: string | null,
      runtimeKey = 0,
      xpertId = 'assistant-1',
    ) => (
      <StreamProvider
        apiKey="cs-x-test"
        apiUrl="https://api.example.test/api/ai"
        xpertId={xpertId}
        projectId={projectId}
        initialThread={initialThread}
        runtimeKey={runtimeKey}
        threadStateMode="memory"
      >
        <View />
      </StreamProvider>
    );
    const { rerender, getByTitle } = render(tree('project-1', 'thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    const iframe = getByTitle('persistent-view');
    expect(stream.messages).toHaveLength(2);
    rerender(tree('project-2', null));
    await waitFor(() => expect(stream.conversationId).toBeNull());
    expect(stream.threadId).toBeNull();
    expect(stream.messages).toHaveLength(0);
    expect(stream.projectId).toBe('project-2');
    expect(getByTitle('persistent-view')).toBe(iframe);
    expect(unmount).not.toHaveBeenCalled();
    rerender(tree('project-2', 'thread-2', 1));
    await waitFor(() =>
      expect(stream.conversationId).toBe('conversation-thread-2'),
    );
    expect(getByTitle('persistent-view')).toBe(iframe);
    expect(stream.messages[0].id).toBe('thread-2-human');
    rerender(tree('project-2', null, 1, 'assistant-2'));
    expect(unmount).toHaveBeenCalledOnce();
    expect(getByTitle('persistent-view')).not.toBe(iframe);
  });
});
