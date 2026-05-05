import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ThemeProvider } from './Theme';

describe('ThemeProvider', () => {
  it('tracks radius without mutating the global radius CSS variable', () => {
    render(
      <ThemeProvider theme={{ radius: 'pill' }}>
        <div data-testid="child" />
      </ThemeProvider>,
    );

    const themedRoot = screen.getByTestId('child').parentElement;
    expect(themedRoot).toHaveAttribute('data-radius', 'pill');
    expect(themedRoot).not.toHaveStyle('--radius: 9999px');
    expect(themedRoot?.style.getPropertyValue('--radius')).toBe('');
  });
});
