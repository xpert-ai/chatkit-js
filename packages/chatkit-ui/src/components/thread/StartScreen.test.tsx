import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StartScreen } from './StartScreen';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string) =>
      ({
        'startScreen.greeting': 'What can I help with today?',
      })[key] ?? key,
  }),
}));

const startScreen = {
  prompts: [
    {
      label: 'Analyze notice',
      prompt: 'Analyze this technical notice',
      icon: 'circle-question' as const,
    },
  ],
};

describe('StartScreen', () => {
  it('does not reserve prompt spacing when prompts are absent', () => {
    render(<StartScreen startScreen={{ greeting: 'Hello' }} />);

    const heading = screen.getByRole('heading', { name: 'Hello' });

    expect(heading).toHaveClass('text-4xl', 'mb-4');
    expect(heading.parentElement).toHaveClass('mb-4');
    expect(heading.parentElement).not.toHaveClass('mb-10');
    expect(screen.queryByText('Analyze notice')).not.toBeInTheDocument();
  });

  it('keeps greeting spacing when prompt cards are present', () => {
    render(<StartScreen startScreen={startScreen} />);

    const heading = screen.getByRole('heading', {
      name: 'What can I help with today?',
    });

    expect(heading).toHaveClass('text-4xl', 'mb-4');
    expect(heading.parentElement).toHaveClass('mb-10');
    expect(screen.getByText('Analyze notice')).toBeInTheDocument();
  });

  it('selects the configured prompt text from a single card', () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <StartScreen startScreen={startScreen} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Analyze notice' }));
    expect(onSelect).toHaveBeenCalledWith('Analyze this technical notice');

    rerender(
      <StartScreen startScreen={startScreen} onSelect={onSelect} disabled />,
    );
    const button = screen.getByRole('button', { name: 'Analyze notice' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
