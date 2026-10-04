import * as React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  setupHistoryTests,
  StreamProvider,
  useTestStream,
  stream,
} from '../testing/history-fixture';

describe('Assistant View lifetime across chat scopes', () => {
  setupHistoryTests();
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
