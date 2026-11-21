import { fireEvent, render, screen } from '@testing-library/react';
import { A2UIProvider, useA2UI } from '@xpert-ai/a2ui-react';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import { WidgetMessage, type WidgetMessageProps } from './widget';

function form(label: string): WidgetMessageProps['data'] {
  return {
    type: 'Widget',
    widgets: [
      {
        name: 'form',
        messages: [
          {
            surfaceUpdate: {
              surfaceId: '@default',
              components: [
                {
                  id: 'root',
                  component: {
                    TextField: {
                      label: { literalString: label },
                      text: { path: '/name' },
                    },
                  },
                },
              ],
            },
          },
          {
            dataModelUpdate: {
              surfaceId: '@default',
              contents: [{ key: 'name', valueString: '' }],
            },
          },
          { beginRendering: { surfaceId: '@default', root: 'root' } },
        ],
      },
    ],
  };
}

function SurfaceState() {
  const { surfaces } = useA2UI();
  return (
    <output data-testid="surfaces">
      {JSON.stringify(
        [...surfaces.values()].map((surface) => surface.dataModel.get('name')),
      )}
    </output>
  );
}

function Cards({
  first,
  second,
}: {
  first?: WidgetMessageProps['data'];
  second?: WidgetMessageProps['data'];
}) {
  return (
    <StrictMode>
      <A2UIProvider>
        {first && (
          <WidgetMessage messageId="message" widgetId="first" data={first} />
        )}
        {second && (
          <WidgetMessage messageId="message" widgetId="second" data={second} />
        )}
        <SurfaceState />
      </A2UIProvider>
    </StrictMode>
  );
}

describe('streamed Widget surfaces', () => {
  it('keeps two cards within the same assistant message independent', () => {
    render(<Cards first={form('First')} second={form('Second')} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'First' }), {
      target: { value: 'Draft' },
    });
    expect(screen.getByRole('textbox', { name: 'First' })).toHaveValue('Draft');
    expect(screen.getByRole('textbox', { name: 'Second' })).toHaveValue('');
    expect(screen.getByTestId('surfaces')).toHaveTextContent('["Draft",""]');
  });

  it('preserves the input and its data model when the same payload is replayed', () => {
    const first = form('Name');
    const view = render(<Cards first={first} />);
    const input = screen.getByRole('textbox', { name: 'Name' });
    fireEvent.change(input, { target: { value: 'Unsaved draft' } });
    input.focus();
    view.rerender(<Cards first={structuredClone(first)} />);
    expect(screen.getByRole('textbox', { name: 'Name' })).toBe(input);
    expect(input).toHaveValue('Unsaved draft');
    expect(input).toHaveFocus();
    expect(screen.getByTestId('surfaces')).toHaveTextContent(
      '["Unsaved draft"]',
    );
  });

  it('applies a changed payload in place and removes only the unmounted card', () => {
    const second = form('Second');
    const view = render(<Cards first={form('First')} second={second} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Second' }), {
      target: { value: 'Keep' },
    });
    view.rerender(
      <Cards
        first={{
          type: 'Widget',
          widgets: [
            {
              name: 'receipt',
              messages: [
                {
                  surfaceUpdate: {
                    surfaceId: '@default',
                    components: [
                      {
                        id: 'receipt',
                        component: {
                          Text: { text: { literalString: 'Confirmed' } },
                        },
                      },
                    ],
                  },
                },
                { beginRendering: { surfaceId: '@default', root: 'receipt' } },
              ],
            },
          ],
        }}
        second={second}
      />,
    );
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'First' }),
    ).not.toBeInTheDocument();
    view.rerender(<Cards second={second} />);
    expect(screen.queryByText('Confirmed')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Second' })).toHaveValue('Keep');
    expect(screen.getByTestId('surfaces')).toHaveTextContent('["Keep"]');
  });
});
