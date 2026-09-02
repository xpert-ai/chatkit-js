import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ThemeProvider } from './Theme';

describe('ThemeProvider', () => {
  it('applies dark mode to the document root for portaled UI and restores it on unmount', () => {
    document.documentElement.classList.remove('dark');
    const { unmount } = render(
      <ThemeProvider theme={{ colorScheme: 'dark' }}>
        <div data-testid="dark-child" />
      </ThemeProvider>,
    );

    expect(document.documentElement).toHaveClass('dark');

    unmount();
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('restores a pre-existing document root theme after a light provider unmounts', () => {
    document.documentElement.classList.add('dark');
    const { unmount } = render(
      <ThemeProvider theme={{ colorScheme: 'light' }}>
        <div data-testid="light-child" />
      </ThemeProvider>,
    );

    expect(document.documentElement).not.toHaveClass('dark');

    unmount();
    expect(document.documentElement).toHaveClass('dark');
    document.documentElement.classList.remove('dark');
  });

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
