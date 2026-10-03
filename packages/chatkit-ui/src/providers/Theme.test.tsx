import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ThemeProvider } from './Theme';

describe('ThemeProvider', () => {
  it('provides inherited surface tokens to messages and updates them with the theme', () => {
    const { rerender } = render(
      <ThemeProvider theme={{ radius: 'sharp', density: 'compact' }}>
        <div data-testid="surface" />
      </ThemeProvider>,
    );
    const root = screen.getByTestId('surface').parentElement;
    if (!root) throw new Error('ThemeProvider root is missing');
    expect(root.style.getPropertyValue('--chat-panel-radius')).toBe('0px');
    expect(root.style.getPropertyValue('--chat-density-scale')).toBe('0.75');
    rerender(
      <ThemeProvider theme={{ radius: 'round', density: 'spacious' }}>
        <div data-testid="surface" />
      </ThemeProvider>,
    );
    expect(root.style.getPropertyValue('--chat-panel-radius')).toBe(
      'calc(var(--radius, 0.625rem) + 4px)',
    );
    expect(root.style.getPropertyValue('--chat-density-scale')).toBe('1.25');
  });
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
