import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { flushSync } from 'react-dom';

import { SendButton } from './SendButton';

describe('SendButton', () => {
  it('uses theme radius for the compact near-black send control', () => {
    render(<SendButton sendLabel="Send" />);

    const button = screen.getByRole('button', { name: 'Send' });
    expect(button).toHaveClass(
      'size-8',
      'rounded-chat-item',
      'bg-foreground',
      'text-background',
    );
    expect(button.querySelector('.lucide-arrow-up')).toBeInTheDocument();
  });

  it('keeps the stop state at the same size and shape', () => {
    render(<SendButton showStop stopLabel="Stop" />);

    expect(screen.getByRole('button', { name: 'Stop' })).toHaveClass(
      'size-8',
      'rounded-chat-item',
      'bg-foreground',
    );
  });

  it('blocks repeat run-control clicks while the request is pending', () => {
    const onStop = vi.fn();
    const { rerender } = render(
      <SendButton showStop stopDisabled onStop={onStop} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onStop).not.toHaveBeenCalled();
    rerender(<SendButton showStop disabled onStop={onStop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    // An empty/disabled composer must not disable the active run control.
    expect(onStop).toHaveBeenCalledTimes(1);
  });
  it('resumes from the same themed control without submitting the composer', () => {
    const onResume = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const { rerender } = render(
      <form onSubmit={onSubmit}>
        <SendButton
          showResume
          disabled
          resumeLabel="Resume"
          onResume={onResume}
        />
      </form>,
    );
    const button = screen.getByRole('button', { name: 'Resume' });
    expect(button).toHaveClass('size-8', 'rounded-chat-item', 'bg-foreground');
    expect(button.querySelector('.lucide-play')).toBeInTheDocument();
    fireEvent.click(button);
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
    rerender(<SendButton showResume resumeDisabled onResume={onResume} />);
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it.each(['stop', 'resume'] as const)(
    'does not submit when %s immediately changes the control to send',
    (mode) => {
      const onSubmit = vi.fn((event: React.FormEvent) =>
        event.preventDefault(),
      );
      function Fixture() {
        const [active, setActive] = useState(true);
        const complete = () => flushSync(() => setActive(false));
        return (
          <form onSubmit={onSubmit}>
            <SendButton
              showStop={active && mode === 'stop'}
              showResume={active && mode === 'resume'}
              onStop={complete}
              onResume={complete}
            />
          </form>
        );
      }
      render(<Fixture />);
      fireEvent.click(
        screen.getByRole('button', {
          name: mode === 'stop' ? 'Stop' : 'Resume',
        }),
      );
      expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
      expect(onSubmit).not.toHaveBeenCalled();
    },
  );
});
