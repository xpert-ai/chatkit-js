import {
  ChatMessageEventTypeEnum,
  ChatMessageTypeEnum,
} from '@xpert-ai/chatkit-types';
import { describe, expect, it } from 'vitest';
import { createLangGraphEventState } from '../providers/langGraphEventMapper';
import { applyStreamEvent } from '../providers/stream/events/apply-stream-event';
import { applyOptimisticValues } from '../providers/stream/messages/reducer';
import type { StateType, StreamSubmitOptions } from '../providers/stream/types';
import { fixture, setupWorkbenchTests } from './WorkbenchShell.test-fixture';

const {
  React,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  vi,
  mocks,
  WorkbenchShell,
  WorkbenchToggleButton,
  manifest,
  baseOptions,
  setObservedWidth,
} = fixture;

async function openView() {
  mocks.listSlotViews.mockResolvedValue([manifest]);
  mocks.submit.mockResolvedValue(undefined);
  render(
    <WorkbenchShell
      options={{ ...baseOptions, workbench: { enabled: true } }}
      locale="en-US"
      onRequestContextChange={vi.fn()}
    >
      <WorkbenchToggleButton />
    </WorkbenchShell>,
  );
  setObservedWidth(1200);
  await waitFor(() =>
    expect(screen.getByLabelText('Open views')).toBeEnabled(),
  );
  fireEvent.click(screen.getByLabelText('Open views'));
  await screen.findByTestId('remote-view');
}

async function sendMessage(payload: {
  text: string;
  clientMessageId?: string;
  newThread?: boolean;
  followUpMode?: 'queue' | 'steer';
}) {
  await act(async () => {
    await mocks.remoteViewProps?.onClientCommand(
      'assistant.chat.send_message',
      payload,
      manifest,
    );
  });
}

describe('Workbench message identity', () => {
  setupWorkbenchTests();

  it.each([
    { label: 'active thread', newThread: false },
    { label: 'new thread', newThread: true },
    { label: 'caller-provided identity', clientMessageId: 'review-request' },
  ])(
    'reconciles the optimistic review request in a $label',
    async (payload) => {
      await openView();
      await sendMessage({ text: 'Review this document', ...payload });

      expect(mocks.submit).toHaveBeenCalledTimes(1);
      const request = mocks.submit.mock.calls[0][0];
      const options: StreamSubmitOptions = mocks.submit.mock.calls[0][1];
      expect(request.id).toEqual(expect.any(String));
      expect(request.id).not.toBe('');
      if (payload.clientMessageId) {
        expect(request.id).toBe(payload.clientMessageId);
      }
      expect(options.optimisticValues).toEqual(expect.any(Function));
      let state = applyOptimisticValues(
        { messages: [] },
        options.optimisticValues!,
      );
      expect(state.messages).toEqual([
        expect.objectContaining({
          id: request.id,
          type: 'human',
          content: 'Review this document',
        }),
      ]);

      const events = createLangGraphEventState();
      const setValues = (
        next: StateType | ((previous: StateType) => StateType),
      ) => {
        state = typeof next === 'function' ? next(state) : next;
      };
      applyStreamEvent(
        {
          event: 'message',
          data: JSON.stringify({
            type: ChatMessageTypeEnum.EVENT,
            event: ChatMessageEventTypeEnum.ON_CONVERSATION_START,
            data: {
              id: 'conversation',
              userMessage: {
                id: 'persisted-review',
                clientMessageId: request.id,
                role: 'human',
                content: 'Review this document',
              },
            },
          }),
        },
        setValues,
        vi.fn(),
        vi.fn(),
        [],
        events,
      );
      expect(state.messages).toEqual([
        expect.objectContaining({
          id: 'persisted-review',
          type: 'human',
          content: 'Review this document',
        }),
      ]);
    },
  );

  it('keeps separate identities for repeated requests with the same text', async () => {
    await openView();
    await sendMessage({ text: 'Review this document' });
    await sendMessage({ text: 'Review this document' });

    expect(mocks.submit).toHaveBeenCalledTimes(2);
    const ids = mocks.submit.mock.calls.map(([request]) => request.id);
    expect(ids).toEqual([expect.any(String), expect.any(String)]);
    expect(new Set(ids).size).toBe(2);
  });

  it.each(['queue', 'steer'] as const)(
    'supplies an identity for %s without inserting an optimistic message',
    async (followUpMode) => {
      await openView();
      mocks.stream.isLoading = true;
      await sendMessage({ text: 'Review this document', followUpMode });

      expect(mocks.submit).toHaveBeenCalledTimes(1);
      const [request, options] = mocks.submit.mock.calls[0];
      expect(request.id).toEqual(expect.any(String));
      expect(options.followUpMode).toBe(followUpMode);
      expect(options.optimisticValues).toBeUndefined();
    },
  );
});
