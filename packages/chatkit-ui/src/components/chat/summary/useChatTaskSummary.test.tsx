import * as React from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  WorkbenchContext,
  disabledWorkbenchContext,
} from '../../../workbench/context';
import {
  collectLiveTaskSummary,
  mergeTaskSummary,
} from '../../../lib/task-summary';
import { useChatTaskSummary } from './useChatTaskSummary';

vi.mock('../../../hooks/useTaskSummary', () => ({
  useTaskSummary: () => ({
    summary: mergeTaskSummary(null, collectLiveTaskSummary({ messages: [] })),
    retryHistory: vi.fn(),
    loadSection: vi.fn(),
  }),
}));
vi.mock('../../../hooks/useOpenTaskSummaryResource', () => ({
  useOpenTaskSummaryResource: () => vi.fn(),
}));

type Options = Parameters<typeof useChatTaskSummary>[0];

// Only the stream fields consumed by this hook are needed for the layout fixture.
function options(): Options {
  return {
    options: undefined,
    stream: {
      threadId: 'main',
      conversationId: 'conversation-1',
      assistantId: 'assistant-1',
      runtimeActivities: { sandboxServices: { services: [] } },
    } as unknown as Options['stream'],
    pendingFollowUps: [],
    messages: [],
    runtimeCapabilityOptions: [],
    threadGoal: null,
    t: ((key: string) => key) as Options['t'],
    messageNavigationAnchorsRef: { current: new Map() },
    disableAutoFollow: vi.fn(),
    clearQuoteSelection: vi.fn(),
    focusComposerAt: vi.fn(),
    parentMessenger: {} as Options['parentMessenger'],
    viewportRef: { current: null },
    chatColumnRef: { current: null },
    layoutMaxWidth: undefined,
  };
}

describe('Unified summary availability', () => {
  const sideChats = {
    sessions: [],
    ready: true,
    opening: false,
    error: null,
    activeId: undefined,
    askInSideChat: vi.fn(),
    openSideChat: vi.fn(),
    renameSideChat: vi.fn(),
    closeSideChat: vi.fn(),
    updateStatus: vi.fn(),
    reload: vi.fn(),
  };

  it.each([
    { sideChatEnabled: true, enabled: undefined, visible: true },
    { sideChatEnabled: true, enabled: false, visible: false },
    { sideChatEnabled: false, enabled: undefined, visible: false },
    { sideChatEnabled: false, enabled: true, visible: true },
  ])(
    'respects summary enabled=$enabled with side chats=$sideChatEnabled',
    ({ sideChatEnabled, enabled, visible }) => {
      const input = options();
      if (enabled !== undefined)
        input.options = { taskSummary: { enabled } } as Options['options'];
      const { result } = renderHook(() => useChatTaskSummary(input), {
        wrapper: ({ children }) => (
          <WorkbenchContext.Provider
            value={{ ...disabledWorkbenchContext, sideChatEnabled, sideChats }}
          >
            {children}
          </WorkbenchContext.Provider>
        ),
      });
      expect(result.current.taskSummaryAvailable).toBe(visible);
      expect(result.current.taskSummaryProps.sideChats).toBe(
        sideChatEnabled ? sideChats : undefined,
      );
    },
  );
});
