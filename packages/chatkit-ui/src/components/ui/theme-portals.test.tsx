import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CSSProperties } from 'react';
import { ThemeProvider } from '../../providers/Theme';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

function PortaledSurface({
  kind,
  style,
}: {
  kind: 'popover' | 'menu' | 'tooltip';
  style?: CSSProperties;
}) {
  if (kind === 'popover') {
    return (
      <Popover open>
        <PopoverTrigger>Project</PopoverTrigger>
        <PopoverContent data-testid="surface" style={style}>
          Projects
        </PopoverContent>
      </Popover>
    );
  }
  if (kind === 'menu') {
    return (
      <DropdownMenu open modal={false}>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent data-testid="surface" style={style}>
          <DropdownMenuItem>History</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  return (
    <Tooltip open>
      <TooltipTrigger>Summary</TooltipTrigger>
      <TooltipContent data-testid="surface" style={style} hideArrow>
        Open summary
      </TooltipContent>
    </Tooltip>
  );
}

describe('portaled surface themes', () => {
  it.each(['popover', 'menu', 'tooltip'] as const)(
    'keeps %s radius tokens connected after leaving the theme DOM subtree',
    (kind) => {
      const { container, rerender } = render(
        <ThemeProvider theme={{ radius: 'sharp' }}>
          <PortaledSurface kind={kind} />
        </ThemeProvider>,
      );
      const surface = screen.getByTestId('surface');
      expect(container.contains(surface)).toBe(false);
      expect(surface.style.getPropertyValue('--chat-panel-radius')).toBe('0px');
      expect(surface.style.getPropertyValue('--chat-item-radius')).toBe('0px');

      rerender(
        <ThemeProvider theme={{ radius: 'round' }}>
          <PortaledSurface kind={kind} />
        </ThemeProvider>,
      );
      expect(surface.style.getPropertyValue('--chat-panel-radius')).toBe(
        'calc(var(--radius, 0.625rem) + 4px)',
      );
      expect(surface.style.getPropertyValue('--chat-item-radius')).toBe(
        'var(--radius, 0.625rem)',
      );
    },
  );

  it('keeps an explicit surface style override', () => {
    render(
      <ThemeProvider theme={{ radius: 'sharp' }}>
        <PortaledSurface
          kind="popover"
          style={
            {
              '--chat-item-radius': '3px',
              opacity: 0.8,
            } as CSSProperties
          }
        />
      </ThemeProvider>,
    );
    expect(
      screen
        .getByTestId('surface')
        .style.getPropertyValue('--chat-item-radius'),
    ).toBe('3px');
    expect(screen.getByTestId('surface').style.opacity).toBe('0.8');
  });

  it('supports standalone UI primitives without a theme provider', () => {
    render(<PortaledSurface kind="popover" />);
    expect(screen.getByTestId('surface')).toBeVisible();
  });
});
