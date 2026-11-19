import { fireEvent, render, screen, within } from '@testing-library/react';
import { A2UIProvider, type Types } from '@xpert-ai/a2ui-react';
import type { ChatKitTheme } from '@xpert-ai/chatkit-types';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../../providers/Theme';
import { WidgetMessage } from './widget';

function projectCard(maxAllowedSelections = 1) {
  const surfaceId = 'project';
  const components: Types.ComponentInstance[] = [
    {
      id: 'root',
      component: {
        Column: { children: { explicitList: ['choice', 'button'] } },
      },
    },
    {
      id: 'choice',
      component: {
        MultipleChoice: {
          label: { literalString: 'Project' },
          selections: { path: '/project' },
          options: [
            { value: '', label: { literalString: 'Choose a project' } },
            { value: '0', label: { literalString: 'Sales' } },
            { value: '2', label: { literalString: 'Support' } },
            { value: 'other', label: { literalString: 'Other' } },
          ],
          maxAllowedSelections,
        },
      },
    },
    {
      id: 'caption',
      component: { Text: { text: { literalString: 'Move and continue' } } },
    },
    {
      id: 'button',
      component: {
        Button: {
          child: 'caption',
          action: {
            name: 'confirm',
            context: [{ key: 'target', value: { path: '/project' } }],
          },
        },
      },
    },
  ];
  return {
    type: 'Widget' as const,
    widgets: [
      {
        name: 'move',
        messages: [
          { surfaceUpdate: { surfaceId, components } },
          {
            dataModelUpdate: {
              surfaceId,
              contents: [{ key: 'project', valueString: '2' }],
            },
          },
          { beginRendering: { surfaceId, root: 'root' } },
        ],
      },
    ],
  };
}

describe('A2UI project choice', () => {
  it('restores the bound ID, themes the open dropdown, and writes a string only on selection', async () => {
    const card = projectCard();
    const onAction = vi.fn();
    const view = (theme: ChatKitTheme) => (
      <ThemeProvider theme={theme}>
        <A2UIProvider onAction={onAction}>
          <WidgetMessage messageId="reply" data={card} />
        </A2UIProvider>
      </ThemeProvider>
    );
    const { rerender } = render(
      view({ radius: 'sharp', density: 'compact', colorScheme: 'light' }),
    );
    const trigger = await screen.findByRole('combobox', { name: 'Project' });
    expect(trigger).toHaveAttribute('data-slot', 'select-trigger');
    expect(trigger).toHaveTextContent('Support');
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const menu = await screen.findByRole('listbox');
    const themeRoot = trigger.closest<HTMLElement>('[data-density]')!;
    expect(themeRoot).toContainElement(menu);
    expect(themeRoot.style.getPropertyValue('--chat-panel-radius')).toBe('0px');
    expect(themeRoot.style.getPropertyValue('--chat-density-scale')).toBe('0.75');
    expect(
      within(menu).getByRole('option', { name: 'Support' }),
    ).toHaveAttribute('aria-selected', 'true');
    rerender(
      view({ radius: 'round', density: 'spacious', colorScheme: 'dark' }),
    );
    expect(themeRoot.style.getPropertyValue('--chat-density-scale')).toBe('1.25');
    expect(themeRoot.style.getPropertyValue('--chat-panel-radius')).toContain(
      '+ 4px',
    );
    expect(menu.closest('.dark')).not.toBeNull();
    fireEvent.click(within(menu).getByRole('option', { name: 'Sales' }));
    expect(trigger).toHaveTextContent('Sales');
    expect(onAction).not.toHaveBeenCalled();
    const confirm = screen.getByRole('button', { name: 'Move and continue' });
    fireEvent.click(confirm);
    expect(onAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ context: { target: '0' } }),
    );
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(
      await screen.findByRole('option', { name: 'Choose a project' }),
    );
    expect(trigger).toHaveTextContent('Choose a project');
    fireEvent.click(confirm);
    expect(onAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ context: { target: '' } }),
    );
  });

  it('switches between two fields on one surface without submitting either one', async () => {
    const card = projectCard();
    const components = card.widgets[0].messages[0].surfaceUpdate!.components;
    components.push(
      {
        id: 'modes',
        component: {
          Tabs: {
            tabItems: [
              { title: { literalString: 'Existing project' }, child: 'root' },
              { title: { literalString: 'New project' }, child: 'new-name' },
            ],
          },
        },
      },
      {
        id: 'new-name',
        component: {
          TextField: {
            label: { literalString: 'Project name' },
            text: { path: '/name' },
          },
        },
      },
    );
    Object.assign(card.widgets[0].messages.at(-1)!.beginRendering!, {
      root: 'modes',
      styles: { tabsVariant: 'radio' },
    });
    const onAction = vi.fn();
    render(
      <A2UIProvider onAction={onAction}>
        <WidgetMessage messageId="switch" data={card} />
      </A2UIProvider>,
    );
    const existing = await screen.findByRole('radio', {
      name: 'Existing project',
    });
    expect(existing).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'New project' }));
    expect(screen.getByRole('textbox')).toHaveValue('');
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Sales QA' },
    });
    expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.click(existing);
    expect(screen.getByRole('combobox')).toHaveTextContent('Support');
    fireEvent.click(screen.getByRole('radio', { name: 'New project' }));
    expect(screen.getByRole('textbox')).toHaveValue('Sales QA');
    expect(onAction).not.toHaveBeenCalled();
  });

  it('preserves native multi-select and submits an array limited to the allowed count', async () => {
    const onAction = vi.fn();
    render(
      <A2UIProvider onAction={onAction}>
        <WidgetMessage messageId="reply" data={projectCard(2)} />
      </A2UIProvider>,
    );
    const list = await screen.findByRole<HTMLSelectElement>('listbox', {
      name: 'Project',
    });
    expect(list.multiple).toBe(true);
    for (const option of list.options) option.selected = !!option.value;
    fireEvent.change(list);
    fireEvent.click(screen.getByRole('button', { name: 'Move and continue' }));
    expect(onAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ context: { target: ['0', '2'] } }),
    );
  });
});
