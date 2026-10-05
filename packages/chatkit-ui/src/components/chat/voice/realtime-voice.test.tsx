import * as React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  CompletedVoiceCall,
  RealtimeVoiceOptions,
} from '@xpert-ai/chatkit-types';
import { ThemeProvider } from '../../../providers/Theme';
import { AssistantSummaryDialog } from '../header/AssistantPresence';
import { mergeTaskSummary } from '../../../lib/task-summary';
import { MessageList } from '../../thread/MessageList';
import { mergeCompletedCalls, useRealtimeVoice } from './useRealtimeVoice';

const receipt: CompletedVoiceCall = {
  id: 'call-1',
  threadId: 'thread-1',
  content: {
    type: 'call_ended',
    sessionId: 'call-1',
    startedAt: '2026-10-05T01:00:00Z',
    endedAt: '2026-10-05T01:01:17Z',
    durationSeconds: 77,
  },
};
function Harness({
  options,
  open = true,
}: {
  options: RealtimeVoiceOptions;
  open?: boolean;
}) {
  const voice = useRealtimeVoice({
    options,
    assistantId: 'assistant-1',
    threadId: 'thread-1',
    avatar: null,
  });
  return (
    <ThemeProvider>
      <AssistantSummaryDialog
        presence={{
          name: 'Bosi',
          avatar: null,
          state: 'idle',
          waitingForInput: false,
          open,
          onOpenChange: vi.fn(),
        }}
        voice={voice}
        summary={{
          summary: mergeTaskSummary(null, {
            outputs: [],
            sources: [],
            agents: [],
            pending: [],
            running: [],
            fileChanges: [],
          }),
          onRetryHistory: vi.fn(),
          onLoadSection: vi.fn(),
          onNavigateMessage: vi.fn(),
          onFocusComposer: vi.fn(),
          onOpenResource: vi.fn(),
        }}
      />
    </ThemeProvider>
  );
}

describe('ChatKit realtime voice', () => {
  it('dials from appearance details using the actual assistant and thread', async () => {
    const onCommand = vi.fn();
    render(<Harness options={{ enabled: true, onCommand }} />);
    fireEvent.click(screen.getByRole('button', { name: /^Call$/ }));
    await waitFor(() =>
      expect(onCommand).toHaveBeenCalledExactlyOnceWith({
        type: 'start',
        assistantId: 'assistant-1',
        threadId: 'thread-1',
      }),
    );
  });
  it('keeps mute and hangup above the appearance dialog and survives dialog dismissal', () => {
    const onCommand = vi.fn();
    const options: RealtimeVoiceOptions = {
      enabled: true,
      onCommand,
      call: {
        id: 'call-1',
        assistantId: 'assistant-1',
        threadId: 'thread-1',
        name: 'Bosi',
        state: 'listening',
        muted: false,
        caption: 'I am listening.',
        tasks: [
          { id: 'task-1', label: 'Task running', text: 'Preparing report' },
        ],
      },
    };
    const view = render(<Harness options={options} />);
    const panel = screen.getByRole('complementary', { name: 'Voice call' });
    expect(
      panel.compareDocumentPosition(screen.getByRole('dialog')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Call$/ })).toBeDisabled();
    expect(screen.getByText('I am listening.')).toBeVisible();
    expect(screen.getByText('Preparing report')).toBeVisible();
    expect(within(panel).getAllByRole('button')).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: 'Interrupt speech' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Open conversation' }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mute microphone' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hang up' }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([
      { type: 'mute', callId: 'call-1', muted: true },
      { type: 'end', callId: 'call-1' },
    ]);
    view.rerender(
      <Harness
        options={{ ...options, call: { ...options.call!, muted: true } }}
        open={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Unmute microphone' }));
    expect(onCommand).toHaveBeenLastCalledWith({
      type: 'mute',
      callId: 'call-1',
      muted: false,
    });
    expect(screen.getByRole('button', { name: 'Hang up' })).toBeVisible();
  });
  it('does not expose dialing when the assistant has no voice capability', () => {
    render(<Harness options={{ enabled: false, onCommand: vi.fn() }} />);
    expect(screen.queryByRole('button', { name: /^Call$/ })).toBeNull();
  });
  it('merges confirmed receipts only in their thread and deduplicates persisted history', () => {
    expect(mergeCompletedCalls([], [receipt], 'other')).toEqual([]);
    const live = mergeCompletedCalls([], [receipt], 'thread-1');
    expect(mergeCompletedCalls(live, [receipt], 'thread-1')).toBe(live);
    render(
      <ThemeProvider>
        <MessageList
          messages={live}
          editing={{
            messageId: null,
            enabled: true,
            onStart: vi.fn(),
            onCancel: vi.fn(),
            onSave: vi.fn(),
          }}
        />
      </ThemeProvider>,
    );
    expect(screen.getByText(/Call ended/)).toHaveTextContent(
      '1:17 · Call ended',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
