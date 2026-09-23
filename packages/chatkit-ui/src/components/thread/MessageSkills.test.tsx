import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatSkillUsage } from '@xpert-ai/chatkit-types';
import { MessageActions } from './MessageActions';
import { MessageList } from './MessageList';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US' },
  }),
}));
const usage: ChatSkillUsage = {
  skillId: 'research',
  name: 'Research',
  version: '1',
  source: { type: 'project', id: 'project-1' },
  activation: 'read',
  toolCallId: 'call-1',
  loadedAt: '2026-09-23T00:00:00.000Z',
};
const label = 'messageActions.skills.title';

describe('message Skills footer', () => {
  it('restores history observations only on the owning answer', () => {
    const view = render(
      <MessageList
        messages={[
          {
            id: 'first',
            type: 'assistant',
            status: 'success',
            content: 'First answer',
            taskSummary: { version: 1, skillUsages: [usage] },
          },
          {
            id: 'second',
            type: 'assistant',
            status: 'success',
            content: 'Second answer',
          },
        ]}
      />,
    );
    expect(screen.getAllByRole('button', { name: label })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Research');
    view.rerender(
      <MessageList
        messages={[
          {
            id: 'second',
            type: 'assistant',
            status: 'success',
            content: 'Second answer',
          },
        ]}
      />,
    );
    expect(
      screen.queryByRole('button', { name: label }),
    ).not.toBeInTheDocument();
  });
  it('retains observations when the owning process is collapsed into the final answer', () => {
    render(
      <MessageList
        collapseProcess
        messages={[
          { id: 'human', type: 'user', content: 'Question' },
          {
            id: 'progress',
            type: 'assistant',
            status: 'success',
            content: 'Progress',
            taskSummary: { version: 1, skillUsages: [usage] },
          },
          {
            id: 'final',
            type: 'assistant',
            status: 'success',
            content: 'Final answer',
          },
        ]}
      />,
    );
    expect(screen.getAllByRole('button', { name: label })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Research');
  });
  it.each([{ isAssistant: false }, { isAssistant: true, isStreaming: true }])(
    'hides unsupported footers: %j',
    (props) => {
      render(
        <MessageActions content="Answer" skillUsages={[usage]} {...props} />,
      );
      expect(
        screen.queryByRole('button', { name: label }),
      ).not.toBeInTheDocument();
    },
  );
  it('hides the control on old messages and renders it after observations arrive', () => {
    const view = render(<MessageActions content="Answer" isAssistant />);
    expect(
      screen.queryByRole('button', { name: label }),
    ).not.toBeInTheDocument();
    view.rerender(
      <MessageActions content="Answer" isAssistant skillUsages={[usage]} />,
    );
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  });
  it('shows multiple skills and origins on click, and supports Escape and reopening', async () => {
    render(
      <MessageActions
        content="Answer"
        isAssistant
        skillUsages={[
          usage,
          {
            ...usage,
            skillId: 'writing',
            name: 'Writing',
            source: { type: 'plugin', id: 'plugin-1' },
          },
        ]}
      />,
    );
    const trigger = screen.getByRole('button', { name: label });
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: label })).toHaveTextContent(
      'Research',
    );
    expect(screen.getByRole('dialog')).toHaveTextContent('Writing');
    expect(
      screen.getByText('messageActions.skills.sources.plugin'),
    ).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('opens on hover and keyboard focus without stealing focus', async () => {
    const onOpen = vi.fn();
    render(
      <MessageActions
        content="Answer"
        isAssistant
        skillUsages={[usage]}
        onActionTooltipOpen={onOpen}
      />,
    );
    const trigger = screen.getByRole('button', { name: label });
    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.pointerLeave(trigger);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    fireEvent.focus(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onOpen).toHaveBeenCalled();
    fireEvent.blur(trigger);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });
});
