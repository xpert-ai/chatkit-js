import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessageActions } from './MessageActions';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({ t: (key: string) => key }),
}));

describe('Message actions', () => {
  it('branches directly without opening a menu', () => {
    const branch = vi.fn();
    render(
      <MessageActions
        content="Answer"
        isAssistant
        onBranch={branch}
        branching={{ available: true }}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'messageActions.branch' }),
    );
    expect(branch).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'messageActions.more' }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['messageActions.copy', true],
    ['messageActions.regenerate', true],
    ['messageActions.branch', true],
    ['threadControl.editMessage', false],
  ] as const)(
    'shows a tooltip on keyboard focus for %s',
    async (label, isAssistant) => {
      const stopFollowing = vi.fn();
      render(
        <MessageActions
          content="Answer"
          isAssistant={isAssistant}
          onRetry={vi.fn()}
          onEdit={vi.fn()}
          onBranch={vi.fn()}
          onActionTooltipOpen={stopFollowing}
          branching={{ available: true }}
        />,
      );
      fireEvent.focus(screen.getByRole('button', { name: label }));
      expect(await screen.findByRole('tooltip')).toHaveTextContent(label);
      expect(stopFollowing).toHaveBeenCalledOnce();
    },
  );

  it('explains the unavailable state on focus and prevents branching', async () => {
    const branch = vi.fn();
    render(
      <MessageActions
        content="Answer"
        isAssistant
        onBranch={branch}
        branching={{ available: false, reason: 'checkpoint_unavailable' }}
      />,
    );
    const button = screen.getByRole('button', {
      name: 'messageActions.branch',
    });
    expect(button).toBeDisabled();
    fireEvent.focus(button.parentElement!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'messageActions.branchReasons.checkpoint_unavailable',
    );
    fireEvent.click(button);
    expect(branch).not.toHaveBeenCalled();
  });

  it.each([{ isBranching: true }, { branchDisabled: true }])(
    'prevents clicks while a branch request is pending: %j',
    (props) => {
      const branch = vi.fn();
      render(
        <MessageActions
          content="Answer"
          isAssistant
          onBranch={branch}
          branching={{ available: true }}
          {...props}
        />,
      );
      const button = screen.getByRole('button', {
        name: 'messageActions.branch',
      });
      expect(button).toBeDisabled();
      fireEvent.click(button);
      expect(branch).not.toHaveBeenCalled();
    },
  );

  it.each([
    { isAssistant: false, branching: { available: true } },
    { isAssistant: true, isStreaming: true, branching: { available: true } },
    { isAssistant: true },
  ])('hides unsupported branch actions: %j', (props) => {
    render(<MessageActions content="Message" onBranch={vi.fn()} {...props} />);
    expect(
      screen.queryByRole('button', { name: 'messageActions.branch' }),
    ).not.toBeInTheDocument();
  });

  it('does not expose branch actions on a read-only transcript', () => {
    render(
      <MessageActions
        content="Message"
        isAssistant
        branching={{ available: true }}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'messageActions.branch' }),
    ).not.toBeInTheDocument();
  });
});
