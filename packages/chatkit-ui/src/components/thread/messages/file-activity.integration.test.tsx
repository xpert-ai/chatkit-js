import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { AssistantMessage } from './ai';
import { ThemeProvider } from '../../../providers/Theme';
import { applyStreamEvent, normalizeConversationMessagesPage, type StateType } from '../../../providers/Stream';
import { createLangGraphEventState } from '../../../providers/langGraphEventMapper';
import { actualTool, changesReceipt, deliveryReceipt, legacyReceipt } from '../../../test/file-activity-fixtures';
import { collectLiveTaskSummary } from '../../../lib/task-summary';
import type { ChatkitMessage } from '@xpert-ai/chatkit-types';
import { hasRenderableAssistantMessage } from '../../../lib/message';

afterEach(cleanup);
describe('file receipts across streaming, history and assistant rendering', () => {
  it('keeps receipt-only deliverables visible without inventing a tool row', () => {
    const message: ChatkitMessage & { type: 'assistant' } = { id: 'reply', type: 'assistant', content: [changesReceipt, deliveryReceipt], status: 'success' };
    expect(hasRenderableAssistantMessage(message)).toBe(true);
    const { container } = render(<ThemeProvider><AssistantMessage message={message} /></ThemeProvider>);
    expect(screen.getByText('Final report')).toBeVisible();
    expect(container.querySelector('[data-slot="file-change-card"]')).not.toBeNull();
    expect(container.querySelectorAll('li.ck-tool-call-row-enter')).toHaveLength(0);
    expect(hasRenderableAssistantMessage({ content: [{ ...changesReceipt, data: { ...changesReceipt.data, kind: 'changes', coverage: 'bounded', fileChanges: [] } }] })).toBe(false);
  });
  it.each([false, true])('renders one invocation while keeping deliverables and review (legacy=%s)', (legacy) => {
    const content = [actualTool, legacy ? legacyReceipt : changesReceipt, deliveryReceipt];
    const message: ChatkitMessage & { type: 'assistant' } = { id: 'reply', type: 'assistant', content, status: 'success' };
    const { container, rerender } = render(<ThemeProvider><AssistantMessage message={message} /></ThemeProvider>);
    expect(container.querySelectorAll('li.ck-tool-call-row-enter')).toHaveLength(1);
    expect(screen.queryByText('File changes', { exact: true })).toBeNull();
    expect(screen.getByText('Final report')).toBeVisible();
    const card = container.querySelector('[data-slot="file-change-card"]');
    expect(card).not.toBeNull();
    expect(container.querySelector('[data-slot="file-change-rows"] button')).toHaveTextContent('final.json');
    rerender(<ThemeProvider><AssistantMessage message={{ ...message, content: JSON.parse(JSON.stringify(content)) }} /></ThemeProvider>);
    expect(container.querySelectorAll('li.ck-tool-call-row-enter')).toHaveLength(1);
    expect(screen.getByText('Final report')).toBeVisible();
  });
  it('keeps the same cards after receipt replay, message completion and history reload', () => {
    let state: StateType = { messages: [{ id: 'reply', type: 'ai', executionId: 'run', content: [actualTool], status: 'answering' }] };
    const setValues: React.Dispatch<React.SetStateAction<StateType>> = update => { state = typeof update === 'function' ? update(state) : update; };
    const log = vi.fn();
    const emit = (payload: object) => applyStreamEvent({ event: 'message', data: JSON.stringify(payload) }, setValues, vi.fn(), log, [], createLangGraphEventState());
    for (const data of [changesReceipt, deliveryReceipt, changesReceipt, deliveryReceipt]) emit({ type: 'message', data });
    expect(log).not.toHaveBeenCalled();
    expect(state.messages[0].content).toHaveLength(3);
    const before = collectLiveTaskSummary({ messages: state.messages });
    emit({ type: 'event', event: 'on_message_end', data: { id: 'reply', role: 'ai', status: 'success', content: state.messages[0].content } });
    const history = normalizeConversationMessagesPage({ items: [{ id: 'reply', role: 'ai', status: 'success', content: state.messages[0].content }] });
    const after = collectLiveTaskSummary({ messages: history.messages });
    expect(after.outputs).toEqual(before.outputs);
    expect(after.fileChanges).toEqual(before.fileChanges);
    expect(after.outputs).toHaveLength(1);
    expect(after.fileChanges).toHaveLength(1);
  });
});
