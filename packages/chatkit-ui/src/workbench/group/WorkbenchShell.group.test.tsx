import { describe, expect, it } from 'vitest';
import { Client } from '@xpert-ai/xpert-sdk';
import {
  fixture,
  setupWorkbenchTests,
  type StateType,
} from '../WorkbenchShell.test-fixture';
import {
  WorkbenchRuntimeContext,
  type WorkbenchRuntime,
} from '../WorkbenchRuntime';

const {
  React,
  render,
  screen,
  fireEvent,
  waitFor,
  vi,
  mocks,
  WorkbenchShell,
  useWorkbench,
  WorkbenchToggleButton,
  baseOptions,
  manifest,
  setObservedWidth,
} = fixture;

function GroupChat() {
  const workbench = useWorkbench();
  return (
    <>
      <WorkbenchToggleButton />
      <input aria-label="Draft" defaultValue="Keep my group draft" />
      <button
        onClick={() =>
          workbench.openGroupAssistant?.({
            messageId: 'message',
            participantId: 'reviewer',
          })
        }
      >
        Reviewer
      </button>
    </>
  );
}

describe('groups in the original WorkbenchShell', () => {
  setupWorkbenchTests();
  it('loads main Assistant views and opens another Assistant record in the same tabs without replacing Chat', async () => {
    const client = new Client<StateType>({
      apiUrl: 'https://example.test/api/ai',
    });
    const views = vi
      .spyOn(client.viewHosts, 'listSlotViews')
      .mockResolvedValue([manifest]);
    const record = vi.spyOn(client.groups, 'runtime').mockResolvedValue({
      conversationId: 'review-conversation',
      threadId: 'review-thread',
      xpertId: 'reviewer',
      participantId: 'reviewer',
      executionId: 'review-execution',
      title: 'Reviewer record',
      status: 'success',
      messages: [],
    });
    const privateRead = vi.spyOn(client.runs, 'get');
    const stream: WorkbenchRuntime = {
      client,
      assistantId: 'main-assistant',
      apiUrl: 'https://example.test/api/ai',
      authenticated: true,
      projectId: 'main-project',
      threadId: 'public-thread',
      conversationId: 'main-runtime',
      runtimeScopeReady: true,
      isLoading: false,
      messages: [],
      historyLoad: { threadId: 'public-thread', status: 'loaded' },
      historyMessagePagination: {
        conversationId: 'group',
        threadId: 'public-thread',
        loadedCount: 0,
        total: 0,
        hasMore: false,
        isLoadingMore: false,
      },
      loadMoreConversationMessages: async () => [],
      group: { id: 'group', sendMessage: vi.fn() },
    };
    render(
      <WorkbenchRuntimeContext.Provider value={stream}>
        <WorkbenchShell
          options={{
            ...baseOptions,
            group: { id: 'group' },
            workbench: { enabled: true },
          }}
          locale="en-US"
          onRequestContextChange={vi.fn()}
        >
          <GroupChat />
        </WorkbenchShell>
      </WorkbenchRuntimeContext.Provider>,
    );
    setObservedWidth(1200);
    await waitFor(() =>
      expect(views).toHaveBeenCalledWith(
        'agent',
        'main-assistant',
        'agent.workbench.fixed',
        expect.objectContaining({
          runtimeScope: {
            projectId: 'main-project',
            conversationId: 'main-runtime',
          },
        }),
      ),
    );
    const draft = screen.getByLabelText('Draft');
    fireEvent.click(screen.getByText('Reviewer'));
    await screen.findByText('Reviewer record');
    expect(screen.getByRole('tab', { name: 'Documents' })).toBeInTheDocument();
    expect(record).toHaveBeenCalledWith(
      'group',
      'message',
      'reviewer',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getByRole('separator')).toBeVisible();
    expect(screen.getByLabelText('Draft')).toBe(draft);
    fireEvent.click(screen.getByRole('tab', { name: 'Documents' }));
    expect(screen.getByLabelText('Draft')).toHaveValue('Keep my group draft');
    expect(views.mock.calls.every((args) => args[1] === 'main-assistant')).toBe(
      true,
    );
    expect(privateRead).not.toHaveBeenCalled();
    expect(mocks.listSlotViews).not.toHaveBeenCalled();
    expect(
      await mocks.remoteViewProps?.onClientCommand(
        'assistant.chat.send_message',
        { text: 'Continue in the group' },
        manifest,
      ),
    ).toEqual({ success: true, status: 'sent', threadId: 'public-thread' });
    expect(stream.group?.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Continue in the group' }),
    );
    vi.mocked(stream.group!.sendMessage).mockResolvedValue(false);
    expect(
      await mocks.remoteViewProps?.onClientCommand(
        'assistant.chat.send_message',
        { text: 'Create a private thread', newThread: true },
        manifest,
      ),
    ).toEqual({
      success: false,
      code: 'unsupported',
      commandKey: 'assistant.chat.send_message',
    });
    expect(
      await mocks.remoteViewProps?.onClientCommand(
        'assistant.context.set',
        { key: 'document', context: { id: 'document-id' } },
        manifest,
      ),
    ).toEqual({
      success: false,
      code: 'unsupported',
      commandKey: 'assistant.context.set',
    });
  });
});
