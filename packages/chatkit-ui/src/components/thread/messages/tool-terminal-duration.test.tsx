import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../../providers/Theme';
import type { AssistantMessageWithAgentRuns } from '../../../lib/agent-run-render-tree';
import { AssistantMessage } from './ai';

vi.mock('../../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    i18n: { language: 'en-US' },
    t: (key: string) => key,
  }),
}));
afterEach(() => vi.useRealTimers());

it('keeps an interrupted child tool frozen after remount and during a later running turn', () => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date('2026-11-21T12:00:00Z'));
  const message: AssistantMessageWithAgentRuns & { type: 'assistant' } = {
    id: 'reply',
    type: 'assistant',
    status: 'success',
    executionId: 'root',
    agentRuns: [
      {
        id: 'child',
        parentId: 'root',
        status: 'error',
        title: 'Review',
        createdAt: '2026-11-21T11:10:02.997Z',
        elapsedTime: 859159,
      },
    ],
    content: [
      {
        id: 'read',
        type: 'component',
        executionId: 'child',
        data: {
          category: 'Tool',
          status: 'running',
          title: 'Reading report',
          created_date: '2026-11-21T11:24:18.977Z',
        },
      },
    ],
  };
  const mount = () =>
    render(<AssistantMessage message={message} isThreadRunning={true} />, {
      wrapper: ThemeProvider,
    });
  const first = mount();
  expect(screen.getByText('3.2s')).toBeInTheDocument();
  expect(
    first.container.querySelector('.ck-tool-call-running-text'),
  ).toBeNull();
  act(() => vi.advanceTimersByTime(60_000));
  expect(screen.getByText('3.2s')).toBeInTheDocument();
  first.unmount();
  mount();
  expect(screen.getByText('3.2s')).toBeInTheDocument();
});
