import * as React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../providers/Theme';
import { WorkbenchAddressBar } from './WorkbenchAddressBar';

function setup(currentUrl?: string) {
  const onOpen = vi.fn();
  const onReload = vi.fn();
  const onSelect = [vi.fn(), vi.fn(), vi.fn()];
  function Bar() {
    const [value, setValue] = React.useState(currentUrl ?? '');
    return (
      <WorkbenchAddressBar
        value={value}
        onChange={setValue}
        apiUrl="/api/ai"
        currentUrl={currentUrl}
        onOpen={onOpen}
        onReload={onReload}
        suggestions={[
          {
            key: 'a',
            title: 'Alpha',
            detail: 'https://alpha.test/',
            history: true,
            onSelect: onSelect[0],
          },
          {
            key: 'b',
            title: 'Beta',
            detail: 'https://beta.test/',
            history: true,
            onSelect: onSelect[1],
          },
          {
            key: 'c',
            title: 'Project notes',
            detail: 'notes.txt',
            onSelect: onSelect[2],
          },
        ]}
      />
    );
  }
  render(
    <ThemeProvider>
      <Bar />
    </ThemeProvider>,
  );
  return { input: screen.getByRole('combobox'), onSelect, onOpen, onReload };
}

describe('WorkbenchAddressBar', () => {
  it('selects filtered suggestions with arrow keys and dismisses with Escape', () => {
    const { input, onSelect, onOpen } = setup();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.focus(input);
    expect(screen.getAllByRole('option')).toHaveLength(3);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(
      'Project notes',
    );
    fireEvent.submit(screen.getByRole('search'));
    expect(onSelect[2]).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'BETA' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option').id,
    );
    fireEvent.submit(screen.getByRole('search'));
    expect(onSelect[1]).toHaveBeenCalledOnce();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens a bare hostname, reloads an unchanged address and leaves IME Enter alone', () => {
    const { input, onOpen, onReload } = setup('https://alpha.test/');
    fireEvent.submit(screen.getByRole('search'));
    expect(onReload).toHaveBeenCalledOnce();
    fireEvent.change(input, { target: { value: 'localhost:5173/demo' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://localhost:5173/demo' }),
    );
    expect(fireEvent.keyDown(input, { key: 'Enter', isComposing: true })).toBe(
      false,
    );
    expect(onOpen).toHaveBeenCalledOnce();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('https://alpha.test/');
  });

  it('shows only website history from the menu and focuses the input', async () => {
    const { input, onSelect } = setup();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Page options' }), {
      key: 'ArrowDown',
    });
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Recent websites' }),
    );
    await waitFor(() => expect(input).toHaveFocus());
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(
      screen.queryByRole('option', { name: /Project notes/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: /Alpha/ }));
    expect(onSelect[0]).toHaveBeenCalledOnce();
  });

  it('offers the current URL for copying and external opening', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    setup('https://alpha.test/');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Page options' }), {
      key: 'ArrowDown',
    });
    expect(
      await screen.findByRole('menuitem', { name: 'Open in browser' }),
    ).toHaveAttribute('href', 'https://alpha.test/');
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Copy link' }));
    });
    expect(writeText).toHaveBeenCalledWith('https://alpha.test/');
  });
});
