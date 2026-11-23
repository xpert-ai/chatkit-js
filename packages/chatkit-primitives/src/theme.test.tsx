import { Fieldset } from './components/ui/fieldset';
import { Slider } from './components/ui/slider';
import * as React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PrimitiveThemeProvider } from './theme';
import { Input } from './components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './components/ui/popover';
import { Dialog, DialogContent, DialogTitle } from './components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import type { SurfaceTheme } from './theme-tokens';

afterEach(cleanup);

function Surface({
  name,
  color,
  density,
  radius,
}: { name: string; color: string } & SurfaceTheme) {
  const ref = React.useRef<HTMLDivElement>(null);
  const theme = React.useMemo(() => ({ density, radius }), [density, radius]);
  return (
    <div
      ref={ref}
      style={{ '--primary': color, overflow: 'hidden' } as React.CSSProperties}
    >
      <PrimitiveThemeProvider
        rootRef={ref}
        theme={theme}
        revision={color.length}
      >
        <Input aria-label={name} />
        <Popover open>
          <PopoverTrigger>{name}</PopoverTrigger>
          <PopoverContent data-testid={name}>{name} menu</PopoverContent>
        </Popover>
      </PrimitiveThemeProvider>
    </div>
  );
}

describe('shared surface themes', () => {
  it('disables non-native controls with their form scope and preserves their value', () => {
    const onValueChange = () => {
      throw new Error('Disabled slider changed');
    };
    render(
      <Fieldset disabled>
        <Slider
          aria-label="Budget"
          value={[10]}
          onValueChange={onValueChange}
        />
      </Fieldset>,
    );
    const slider = screen.getByRole('slider', { name: 'Budget' });
    expect(slider).not.toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '10');
  });

  it('keeps each open portal outside clipping while preserving its own tokens and entered values', () => {
    const view = (density: SurfaceTheme['density']) => (
      <>
        <Surface
          name="first"
          color="#112233"
          radius="sharp"
          density={density}
        />
        <Surface
          name="second"
          color="#445566"
          radius="round"
          density="normal"
        />
      </>
    );
    const { container, rerender } = render(view('compact'));
    const first = screen.getByTestId('first');
    const second = screen.getByTestId('second');
    const portal = first.closest('[data-chatkit-portal-root]');
    expect(container).not.toContainElement(first);
    expect(first.style.getPropertyValue('--primary')).toBe('#112233');
    expect(second.style.getPropertyValue('--primary')).toBe('#445566');
    expect(first.style.getPropertyValue('--chat-density-scale')).toBe('0.75');
    const input = screen.getByLabelText('first');
    fireEvent.change(input, { target: { value: 'Keep this value' } });
    rerender(view('spacious'));
    expect(screen.getByTestId('first')).toBe(first);
    expect(first.closest('[data-chatkit-portal-root]')).toBe(portal);
    expect(screen.getByLabelText('first')).toBe(input);
    expect(input).toHaveValue('Keep this value');
    expect(first.style.getPropertyValue('--chat-density-scale')).toBe('1.25');
    expect(second.style.getPropertyValue('--chat-density-scale')).toBe('1');
  });

  it('accepts host labels without a chat or translation dependency and removes portal roots on unmount', () => {
    const { unmount } = render(
      <PrimitiveThemeProvider labels={{ close: '关闭' }}>
        <Dialog open>
          <DialogContent aria-describedby={undefined}>
            <DialogTitle>Details</DialogTitle>
          </DialogContent>
        </Dialog>
      </PrimitiveThemeProvider>,
    );
    expect(screen.getByRole('button', { name: '关闭' })).toBeVisible();
    expect(document.querySelector('[data-chatkit-portal-root]')).not.toBeNull();
    unmount();
    expect(document.querySelector('[data-chatkit-portal-root]')).toBeNull();
  });

  it('uses shared Tabs keyboard navigation with linked panels', async () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">First</TabsTrigger>
          <TabsTrigger value="b">Second</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>,
    );
    const first = screen.getByRole('tab', { name: 'First' });
    act(() => first.focus());
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    // Radix schedules roving focus to avoid React event batching.
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Second' })).toHaveFocus();
      expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel B');
    });
  });
});
