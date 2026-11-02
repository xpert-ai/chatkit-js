import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../providers/Theme';
import { UserInputDateField } from './user-input-date-field';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US' },
  }),
}));

function Field() {
  const [value, setValue] = React.useState('2026-07-01');
  return (
    <UserInputDateField
      label="Start"
      aria-label="Start"
      value={value}
      onValueChange={setValue}
      buttonClassName="h-9"
    />
  );
}

describe('user input shadcn date picker', () => {
  it('selects a calendar day as a date-only value and returns focus to the trigger', async () => {
    render(<Field />);
    const trigger = screen.getByRole('button', {
      name: 'Start composer.userInputForm.chooseDate',
    });
    fireEvent.click(trigger);
    fireEvent.click(
      await screen.findByRole('button', { name: /July 15th, 2026/ }),
    );
    expect(screen.getByRole('textbox', { name: 'Start' })).toHaveValue(
      '2026-07-15',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('keeps portal theme tokens current while the calendar remains open', async () => {
    const { rerender, container } = render(
      <ThemeProvider
        theme={{ colorScheme: 'light', radius: 'sharp', density: 'compact' }}
      >
        <Field />
      </ThemeProvider>,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start composer.userInputForm.chooseDate',
      }),
    );
    const popup = await screen.findByRole('dialog', { name: 'Start' });
    expect(container.contains(popup)).toBe(false);
    expect(popup.style.getPropertyValue('--chat-item-radius')).toBe('0px');
    expect(popup.style.getPropertyValue('--chat-density-scale')).toBe('0.75');
    rerender(
      <ThemeProvider
        theme={{ colorScheme: 'dark', radius: 'round', density: 'spacious' }}
      >
        <Field />
      </ThemeProvider>,
    );
    expect(popup.style.getPropertyValue('--chat-item-radius')).toBe(
      'var(--radius, 0.625rem)',
    );
    expect(popup.style.getPropertyValue('--chat-density-scale')).toBe('1.25');
    expect(document.documentElement).toHaveClass('dark');
    expect(screen.getByRole('dialog', { name: 'Start' })).toBe(popup);
  });
});
