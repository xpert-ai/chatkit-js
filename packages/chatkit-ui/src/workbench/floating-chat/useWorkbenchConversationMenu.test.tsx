import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Client } from '@xpert-ai/xpert-sdk';
import type { ConversationActionContext } from '../../components/conversation/conversation-actions';
import { useWorkbenchConversationMenu } from './useWorkbenchConversationMenu';

function fixture() {
  const context: ConversationActionContext = {
    client: new Client({ apiUrl: 'https://example.invalid' }),
    scopeKey: 'scope',
    ready: true,
    running: false,
    branchEnabled: true,
    activeThreadId: 'thread',
    activeConversationId: 'record',
    history: {},
    rename: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    navigate: vi.fn(),
  };
  return {
    context,
    target: {
      id: 'thread',
      recordId: 'record',
      title: 'Report',
      status: 'idle' as const,
    },
  };
}

describe('floating conversation action publication', () => {
  it('keeps publication stable while using the latest callbacks', async () => {
    const menu = fixture();
    const { result, rerender } = renderHook(useWorkbenchConversationMenu, {
      initialProps: menu,
    });
    const original = result.current;
    const rename = vi.fn().mockResolvedValue(undefined);
    rerender({
      ...menu,
      context: { ...menu.context, history: {}, rename },
      target: { ...menu.target },
    });
    expect(result.current).toBe(original);
    await result.current?.context.rename(menu.target, 'Updated');
    expect(rename).toHaveBeenCalledWith(menu.target, 'Updated');
    expect(menu.context.rename).not.toHaveBeenCalled();
    rerender({ ...menu, target: { ...menu.target, title: 'Updated' } });
    expect(result.current?.target.title).toBe('Updated');
    expect(result.current).not.toBe(original);
  });

  it('updates availability and blocks actions captured in an old authorization scope', () => {
    const menu = fixture();
    const { result, rerender } = renderHook(useWorkbenchConversationMenu, {
      initialProps: menu,
    });
    const original = result.current;
    rerender({
      ...menu,
      context: { ...menu.context, ready: false, running: true },
    });
    expect(result.current?.context.ready).toBe(false);
    expect(result.current?.context.running).toBe(true);
    expect(() => original?.context.delete(menu.target)).toThrow(
      'Conversation changed',
    );
    rerender({ ...menu, context: { ...menu.context, scopeKey: 'other' } });
    expect(() =>
      original?.context.rename(menu.target, 'Wrong conversation'),
    ).toThrow('Conversation changed');
    expect(menu.context.rename).not.toHaveBeenCalled();
    expect(menu.context.delete).not.toHaveBeenCalled();
  });
});
