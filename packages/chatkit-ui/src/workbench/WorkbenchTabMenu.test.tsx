import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../providers/Theme';
import { WorkbenchTab } from './WorkbenchTab';
import { WorkbenchTabs } from './WorkbenchTabs';
import {
  WorkbenchTabDropdown,
  WorkbenchTabMenuProvider,
} from './WorkbenchTabMenu';

function Fixture({
  guard,
  rename = vi.fn(),
  order = ['main', 'side', 'file'],
}: {
  guard?: () => boolean | Promise<boolean>;
  rename?: () => void;
  order?: string[];
}) {
  const [keys, setKeys] = React.useState(['main', 'side', 'file']);
  const [selected, select] = React.useState('main');
  return (
    <WorkbenchTabMenuProvider
      order={order}
      onError={vi.fn()}
      tabs={keys.map((key) => ({
        key,
        close:
          key === 'main'
            ? undefined
            : async () => {
                if (key === 'file' && guard && !(await guard())) return false;
                setKeys((current) => current.filter((item) => item !== key));
                return true;
              },
        actions:
          key === 'side'
            ? [{ id: 'rename', label: 'Rename side chat', run: rename }]
            : undefined,
      }))}
    >
      <WorkbenchTabs activeKey={selected} order={order}>
        {keys.map((key) => (
          <WorkbenchTab
            key={key}
            label={key}
            icon={null}
            selected={key === selected}
            onSelect={() => select(key)}
          />
        ))}
      </WorkbenchTabs>
      <WorkbenchTabDropdown tabKey="side" />
    </WorkbenchTabMenuProvider>
  );
}
function open(name: string) {
  fireEvent.contextMenu(screen.getByRole('tab', { name }), {
    button: 2,
    clientX: 100,
    clientY: 80,
  });
}

describe('Workbench tab menus', () => {
  it('adds view-specific actions without selecting the right-clicked tab', async () => {
    const rename = vi.fn();
    render(
      <ThemeProvider>
        <Fixture rename={rename} />
      </ThemeProvider>,
    );
    open('side');
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Rename side chat' }),
    );
    await waitFor(() => expect(rename).toHaveBeenCalledOnce());
    expect(screen.getByRole('tab', { name: 'main' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'side' })).toHaveFocus();
  });

  it('closes tabs to the right in displayed order, retaining the main chat', async () => {
    render(
      <ThemeProvider>
        <Fixture order={['file', 'side', 'main']} />
      </ThemeProvider>,
    );
    open('file');
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Close tabs to the right' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('tab', { name: 'side' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('tab', { name: 'main' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'file' })).toBeInTheDocument();
  });

  it('opens the context menu from the focused tab using Shift+F10', async () => {
    render(
      <ThemeProvider>
        <Fixture />
      </ThemeProvider>,
    );
    const tab = screen.getByRole('tab', { name: 'side' });
    tab.focus();
    fireEvent.keyDown(tab, { key: 'F10', shiftKey: true });
    expect(
      await screen.findByRole('menuitem', { name: 'Rename side chat' }),
    ).toBeVisible();
  });

  it('stops bulk close when an editor vetoes closing', async () => {
    const guard = vi.fn().mockResolvedValue(false);
    render(
      <ThemeProvider>
        <Fixture guard={guard} />
      </ThemeProvider>,
    );
    open('side');
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Close all tabs' }),
    );
    await waitFor(() => expect(guard).toHaveBeenCalledOnce());
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('disables Close for the main tab and keeps side-chat-only items out of other menus', async () => {
    render(
      <ThemeProvider>
        <Fixture />
      </ThemeProvider>,
    );
    open('main');
    expect(
      await screen.findByRole('menuitem', { name: 'Close' }),
    ).toHaveAttribute('data-disabled');
    expect(
      screen.queryByRole('menuitem', { name: 'Rename side chat' }),
    ).not.toBeInTheDocument();
  });

  it.each([
    {
      colorScheme: 'light' as const,
      radius: 'sharp' as const,
      density: 'compact' as const,
    },
    {
      colorScheme: 'dark' as const,
      radius: 'round' as const,
      density: 'spacious' as const,
    },
  ])(
    'inherits $colorScheme/$radius/$density theme into the portal',
    async (theme) => {
      render(
        <ThemeProvider theme={theme}>
          <Fixture />
        </ThemeProvider>,
      );
      open('side');
      const menu = await screen.findByRole('menu');
      expect(menu.style.getPropertyValue('--chat-density-scale')).not.toBe('');
      expect(menu.style.getPropertyValue('--chat-item-radius')).not.toBe('');
      expect(menu).toHaveClass('rounded-chat-panel', 'bg-popover');
    },
  );
});
