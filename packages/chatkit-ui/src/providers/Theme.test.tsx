import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
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

  it('updates soft accent colors in the provider and an open portal with the theme', () => {
    const content = (
      <div data-testid="accent-surface">
        <Popover open>
          <PopoverTrigger>Projects</PopoverTrigger>
          <PopoverContent data-testid="accent-portal">Project</PopoverContent>
        </Popover>
      </div>
    );
    const { rerender } = render(
      <ThemeProvider
        theme={{
          colorScheme: 'light',
          radius: 'sharp',
          density: 'compact',
          color: {
            accent: { primary: '#f59e0b', level: 2 },
            surface: { background: '#ffffff', foreground: '#222222' },
          },
        }}
      >
        {content}
      </ThemeProvider>,
    );
    const container = screen.getByTestId('accent-surface').parentElement;
    if (!container) throw new Error('ThemeProvider root is missing');
    const portal = screen.getByTestId('accent-portal');
    expect(container).not.toContainElement(portal);
    expect(portal.style.getPropertyValue('--chat-panel-radius')).toBe('0px');
    expect(portal.style.getPropertyValue('--chat-density-scale')).toBe('0.75');
    for (const element of [container, document.documentElement]) {
      expect(element.style.getPropertyValue('--primary')).toBe('#f59e0b');
      expect(element.style.getPropertyValue('--primary-foreground')).toBe(
        'oklch(0.145 0 0)',
      );
      expect(element.style.getPropertyValue('--accent')).toBe(
        'color-mix(in oklab, var(--primary) 10%, var(--background))',
      );
      expect(element.style.getPropertyValue('--accent-foreground')).toBe(
        'var(--foreground)',
      );
    }

    rerender(
      <ThemeProvider
        theme={{
          colorScheme: 'dark',
          radius: 'round',
          density: 'spacious',
          color: {
            accent: { primary: 'oklch(0.75 0.15 70)', level: 2 },
            surface: { background: '#111827', foreground: '#f9fafb' },
          },
        }}
      >
        {content}
      </ThemeProvider>,
    );
    expect(screen.getByTestId('accent-portal')).toBe(portal);
    expect(portal.style.getPropertyValue('--chat-panel-radius')).toBe(
      'calc(var(--radius, 0.625rem) + 4px)',
    );
    expect(portal.style.getPropertyValue('--chat-density-scale')).toBe('1.25');
    for (const element of [container, document.documentElement]) {
      expect(element.style.getPropertyValue('--primary')).toBe(
        'oklch(0.75 0.15 70)',
      );
      expect(element.style.getPropertyValue('--accent')).toBe(
        'color-mix(in oklab, var(--primary) 20%, var(--background))',
      );
      expect(element.style.getPropertyValue('--accent-foreground')).toBe(
        'var(--foreground)',
      );
      expect(element.style.getPropertyValue('--background')).toBe('#111827');
      expect(element.style.getPropertyValue('--foreground')).toBe('#f9fafb');
    }

    rerender(<ThemeProvider>{content}</ThemeProvider>);
    for (const element of [container, document.documentElement]) {
      for (const token of [
        'primary',
        'primary-foreground',
        'accent',
        'accent-foreground',
      ]) {
        expect(element.style.getPropertyValue(`--${token}`)).toBe('');
      }
    }
  });

  it.each([
    ['dark', 'oklch(0.141 0 0)', 'oklch(0.985 0 0)'],
    ['light', 'rgb(255 255 255)', 'color-mix(in oklab, black 90%, white)'],
    ['light', '#ffffff', '#222222'],
  ] as const)(
    'preserves existing surface colors for %s mode and portaled UI',
    (colorScheme, background, foreground) => {
      const { rerender, unmount } = render(
        <ThemeProvider
          theme={{
            colorScheme,
            color: { surface: { background, foreground } },
          }}
        >
          <div data-testid="surface-colors" />
        </ThemeProvider>,
      );
      const container = screen.getByTestId('surface-colors').parentElement;
      if (!container) throw new Error('ThemeProvider root is missing');
      for (const element of [container, document.documentElement]) {
        expect(element.style.getPropertyValue('--background')).toBe(background);
        expect(element.style.getPropertyValue('--foreground')).toBe(foreground);
        expect(element.style.getPropertyValue('--chat-foreground')).toBe(
          foreground,
        );
      }
      rerender(
        <ThemeProvider theme={{ colorScheme: 'light' }}>
          <div data-testid="surface-colors" />
        </ThemeProvider>,
      );
      for (const element of [container, document.documentElement]) {
        expect(element.style.getPropertyValue('--background')).toBe('');
        expect(element.style.getPropertyValue('--foreground')).toBe('');
        expect(element.style.getPropertyValue('--chat-foreground')).toBe('');
      }
      unmount();
    },
  );
});
