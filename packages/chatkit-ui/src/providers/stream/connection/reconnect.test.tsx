import { act, render, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { HTTPError } from '@xpert-ai/xpert-sdk';
import { mocks, provider, setupHistoryTests, stream } from '../testing/history-fixture';

setupHistoryTests();

it('reconnects status and activity reads after HTTP 400 without recreating or resuming the saved conversation', async () => {
  render(provider('saved-thread'));
  await waitFor(() => expect(stream.messages).toHaveLength(2));
  await waitFor(() => expect(mocks.watchActivity).toHaveBeenCalled());
  const savedMessages = structuredClone(stream.messages);
  const firstActivityCount = mocks.watchActivity.mock.calls.length;
  mocks.getControlView.mockRejectedValueOnce(new HTTPError(400, ''));
  await act(async () => {
    await expect(stream.readThreadControl?.('saved-thread')).rejects.toMatchObject({ status: 400 });
  });
  expect(stream.connectionState).toBe('unavailable');
  mocks.getControlView.mockResolvedValue({
    version: 1, threadId: 'saved-thread', runId: 'saved-run',
    state: 'input_required', revision: '2',
    actions: { canPause: true, canResume: false, canTerminate: true, canSend: false, canQueue: false, canRetry: false, canRespond: true },
  });
  const previousRead = stream.readThreadControl;
  await act(async () => { stream.reconnect?.(); });
  expect(stream.readThreadControl).not.toBe(previousRead);
  await waitFor(() => expect(mocks.watchActivity.mock.calls.length).toBeGreaterThan(firstActivityCount));
  await act(async () => {
    expect(await stream.readThreadControl?.('saved-thread')).toMatchObject({ state: 'input_required' });
  });
  expect(stream.connectionState).toBe('connected');
  expect(stream.threadId).toBe('saved-thread');
  expect(stream.conversationId).toBe('conversation-saved-thread');
  expect(stream.messages).toEqual(savedMessages);
  expect(mocks.createThread).not.toHaveBeenCalled();
  expect(mocks.createConversation).not.toHaveBeenCalled();
  expect(mocks.deleteThread).not.toHaveBeenCalled();
  expect(mocks.runStream).not.toHaveBeenCalled();
  expect(mocks.resumeRun).not.toHaveBeenCalled();
});
