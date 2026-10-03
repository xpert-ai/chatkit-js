import type { Dispatch, SetStateAction } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChatMessageEventTypeEnum, ChatMessageTypeEnum, createResourceCardContent } from '@xpert-ai/chatkit-types';
import { applyStreamEvent, normalizeConversationMessagesPage, type StateType } from './Stream';
import { createLangGraphEventState } from './langGraphEventMapper';
import { messageResourceCards } from '../components/thread/messages/resource-cards';

const receipt = createResourceCardContent({ resource: { namespace: 'platform', type: 'project', id: 'project' }, title: 'Bid',
  open: { target: 'assistant.project', projectId: 'project', viewKey: 'platform.project-tasks__timeline' } });
function fixture() {
  let state: StateType = { messages: [{ id: 'human', type: 'human', content: 'Create project' }] };
  const setValues: Dispatch<SetStateAction<StateType>> = (update) => { state = typeof update === 'function' ? update(state) : update; };
  const error = vi.fn();
  const emit = (type: ChatMessageTypeEnum, data: unknown, event?: ChatMessageEventTypeEnum) =>
    applyStreamEvent({ event: 'message', data: JSON.stringify({ type, data, event }) }, setValues, error, vi.fn(), [], createLangGraphEventState());
  return { state: () => state, error, emit, cancel: () => applyStreamEvent({ event: 'error', data: JSON.stringify('connection closed') }, setValues, error, vi.fn(), [], createLangGraphEventState()) };
}
describe('Resource Card streaming and replay', () => {
  it('hydrates the committed bootstrap receipt before the first model token', () => {
    const f = fixture();
    f.emit(ChatMessageTypeEnum.EVENT, { id: 'reply', role: 'ai', content: [{ ...receipt, messageId: 'reply' }] }, ChatMessageEventTypeEnum.ON_MESSAGE_START);
    expect(messageResourceCards(f.state().messages[1])).toHaveLength(1);
  });
  it('deduplicates replayed events within their exact reply and keeps other replies independent', () => {
    const f = fixture();
    f.emit(ChatMessageTypeEnum.EVENT, { id: 'first', role: 'ai', content: 'Created' }, ChatMessageEventTypeEnum.ON_MESSAGE_START);
    f.emit(ChatMessageTypeEnum.EVENT, { id: 'second', role: 'ai', content: 'Updated' }, ChatMessageEventTypeEnum.ON_MESSAGE_START);
    for (let i = 0; i < 2; i++) f.emit(ChatMessageTypeEnum.MESSAGE, { ...receipt, messageId: 'first' });
    f.emit(ChatMessageTypeEnum.MESSAGE, { ...receipt, messageId: 'second' });
    const first = f.state().messages.find((message) => message.id === 'first')!;
    const second = f.state().messages.find((message) => message.id === 'second')!;
    expect(messageResourceCards(first)).toHaveLength(1);
    expect(messageResourceCards(second)).toHaveLength(1);
    expect(first.content).toContainEqual({ type: 'text', text: 'Created' });
  });
  it('retains an already-created resource across disconnect/cancel and persisted branch hydration', () => {
    const f = fixture();
    f.emit(ChatMessageTypeEnum.EVENT, { id: 'reply', role: 'ai' }, ChatMessageEventTypeEnum.ON_MESSAGE_START);
    f.emit(ChatMessageTypeEnum.MESSAGE, { ...receipt, messageId: 'reply' });
    f.cancel();
    expect(f.error).toHaveBeenCalled();
    const content = f.state().messages[1].content;
    const history = normalizeConversationMessagesPage({ items: [{ id: 'branch-reply', role: 'ai', content: JSON.parse(JSON.stringify(content)), status: 'interrupted' }] });
    expect(messageResourceCards(history.messages[0])[0].data).toEqual(receipt.data);
  });
});
