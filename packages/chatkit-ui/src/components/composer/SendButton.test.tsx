import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SendButton } from './SendButton';

describe('SendButton', () => {
  it('uses the compact near-black circular send style', () => {
    render(<SendButton sendLabel="Send" />);

    const button = screen.getByRole('button', { name: 'Send' });
    expect(button).toHaveClass(
      'size-8',
      'rounded-full',
      'bg-foreground',
      'text-background',
    );
    expect(button.querySelector('.lucide-arrow-up')).toBeInTheDocument();
  });

  it('keeps the stop state at the same size and shape', () => {
    render(<SendButton showStop stopLabel="Stop" />);

    expect(screen.getByRole('button', { name: 'Stop' })).toHaveClass(
      'size-8',
      'rounded-full',
      'bg-foreground',
    );
  });
});
