import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrimitiveThemeProvider } from '@xpert-ai/chatkit-primitives';
import { Types } from '@a2ui/lit/0.8';
import { A2UIProvider } from '../context/A2UIContext';
import { ThemeProvider, defaultTheme } from '../context/ThemeContext';
import { useA2UI } from '../hooks/useA2UI';
import { A2UIRenderer } from './A2UIRenderer';

beforeAll(() => {
  // jsdom has no layout observer; pointer geometry is covered by browser acceptance.
  if (!globalThis.ResizeObserver)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
});
afterEach(cleanup);
const surfaceId = 'shared-controls';
const messages: Types.ServerToClientMessage[] = [
  {
    dataModelUpdate: {
      surfaceId,
      contents: [
        { key: 'name', valueString: 'Initial' },
        { key: 'enabled', valueBoolean: false },
        { key: 'amount', valueNumber: 10 },
      ],
    },
  },
  {
    surfaceUpdate: {
      surfaceId,
      components: [
        { id: 'root', component: { Card: { child: 'fields' } } },
        {
          id: 'fields',
          component: {
            Column: {
              children: {
                explicitList: [
                  'name-field',
                  'enabled-field',
                  'amount-field',
                  'submit',
                ],
              },
            },
          },
        },
        {
          id: 'name-field',
          component: {
            TextField: {
              label: { literalString: 'Name' },
              text: { path: '/name' },
            },
          },
        },
        {
          id: 'enabled-field',
          component: {
            CheckBox: {
              label: { literalString: 'Enabled' },
              value: { path: '/enabled' },
            },
          },
        },
        {
          id: 'amount-field',
          component: {
            Slider: {
              label: { literalString: 'Amount' },
              value: { path: '/amount' },
              minValue: 0,
              maxValue: 100,
            },
          },
        },
        {
          id: 'submitLabel',
          component: { Text: { text: { literalString: 'Submit' } } },
        },
        {
          id: 'submit',
          component: {
            Button: {
              child: 'submitLabel',
              action: {
                name: 'submit_form',
                context: [
                  { key: 'name', value: { path: '/name' } },
                  { key: 'enabled', value: { path: '/enabled' } },
                  { key: 'amount', value: { path: '/amount' } },
                ],
              },
            },
          },
        },
      ],
    },
  },
  { beginRendering: { surfaceId, root: 'root' } },
];
function Surface() {
  const { processMessages } = useA2UI();
  React.useEffect(() => {
    processMessages(messages);
  }, [processMessages]);
  return <A2UIRenderer surfaceId={surfaceId} />;
}

describe('A2UI adapters using shared primitives', () => {
  it('preserves strings, booleans and scalar slider values through controls and live theme changes', async () => {
    const onAction = vi.fn();
    const view = (density: 'compact' | 'spacious') => (
      <PrimitiveThemeProvider theme={{ density }}>
        <ThemeProvider>
          <A2UIProvider onAction={onAction}>
            <Surface />
          </A2UIProvider>
        </ThemeProvider>
      </PrimitiveThemeProvider>
    );
    const { rerender } = render(view('compact'));
    const input = await screen.findByLabelText('Name');
    expect(input).toHaveAttribute('data-slot', 'input');
    fireEvent.change(input, { target: { value: 'Changed' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enabled' }));
    const slider = screen.getByRole('slider', { name: 'Amount' });
    act(() => slider.focus());
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    rerender(view('spacious'));
    expect(screen.getByLabelText('Name')).toBe(input);
    expect(input).toHaveValue('Changed');
    expect(screen.getByRole('checkbox', { name: 'Enabled' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onAction).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        context: { name: 'Changed', enabled: true, amount: 11 },
      }),
    );
  });

  it('retains class-map overrides on shared Button and Card', async () => {
    const theme: Types.Theme = {
      ...defaultTheme,
      components: {
        ...defaultTheme.components,
        Button: { 'rounded-none': true, 'custom-button': true },
        Card: { 'border-0': true, 'custom-card': true },
      },
    };
    const { container } = render(
      <ThemeProvider theme={theme}>
        <A2UIProvider>
          <Surface />
        </A2UIProvider>
      </ThemeProvider>,
    );
    const button = await screen.findByRole('button', { name: 'Submit' });
    expect(button).toHaveAttribute('data-slot', 'button');
    expect(button).toHaveClass('custom-button', 'rounded-none');
    expect(button).not.toHaveClass('rounded-chat-item');
    expect(container.querySelector('[data-slot=card]')).toHaveClass(
      'custom-card',
      'border-0',
    );
  });
});
