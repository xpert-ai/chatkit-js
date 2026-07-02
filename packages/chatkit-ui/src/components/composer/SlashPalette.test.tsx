import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SlashPalette } from './SlashPalette';
import type {
  ResolvedSlashCommand,
  RuntimeCapabilityPaletteState,
  SlashPaletteOption,
} from '../../lib/slash-commands';

const palette: RuntimeCapabilityPaletteState = {
  query: '',
  start: 0,
  end: 1,
  activeIndex: 0,
  atMessageStart: true,
};

const command: ResolvedSlashCommand = {
  id: 'builtin:plan',
  name: 'plan',
  label: 'Plan',
  description: 'Toggle plan mode',
  source: 'builtin',
  action: {
    type: 'insert_text',
    template: '/plan',
  },
  aliases: [],
  kind: 'command',
};

const options: SlashPaletteOption[] = [
  {
    kind: 'command',
    id: 'command:plan',
    label: 'Plan',
    description: 'Toggle plan mode',
    command,
  },
];

describe('SlashPalette', () => {
  it('uses separate radius classes for the panel and items', () => {
    render(
      <SlashPalette
        palette={palette}
        options={options}
        paletteRef={{ current: null }}
        optionRefs={{ current: [] }}
        panelRoundedClass="rounded-3xl"
        itemRoundedClass="rounded-xl"
        emptyLabel="No commands"
        onSelect={vi.fn()}
      />,
    );

    const panel = document.querySelector('[data-slot="slash-palette"]');
    const option = screen.getByRole('button', { name: /Plan/ });

    expect(panel).toHaveClass('rounded-3xl');
    expect(option).toHaveClass('rounded-xl');
    expect(option).not.toHaveClass('rounded-md');
  });

  it('renders capability command child counts next to the title', () => {
    const capabilityCommand: ResolvedSlashCommand = {
      ...command,
      id: 'builtin:skills',
      name: 'skills',
      label: 'Skills',
      description: 'Show runtime skills',
    };

    render(
      <SlashPalette
        palette={palette}
        options={[
          {
            kind: 'command',
            id: 'command:skills',
            label: 'Skills',
            description: 'Show runtime skills',
            command: capabilityCommand,
            capabilityType: 'skill',
            childCount: 3,
          },
        ]}
        paletteRef={{ current: null }}
        optionRefs={{ current: [] }}
        emptyLabel="No commands"
        onSelect={vi.fn()}
      />,
    );

    const option = screen.getByRole('button', { name: /Skills/ });
    const badge = within(option).getByText('3');

    expect(badge).toHaveAttribute('data-slot', 'slash-palette-child-count');
  });

  it('does not tint skill capability rows with the skill color', () => {
    render(
      <SlashPalette
        palette={palette}
        options={[
          {
            kind: 'capability',
            id: 'capability:skill:documents',
            label: 'documents',
            capability: {
              type: 'skill',
              id: 'skill-docs',
              label: 'documents',
              capability: {
                id: 'skill-docs',
                workspaceId: 'workspace-1',
                label: 'documents',
                meta: {
                  color: '#2563EB',
                },
              },
            },
            depth: 1,
          },
        ]}
        paletteRef={{ current: null }}
        optionRefs={{ current: [] }}
        emptyLabel="No commands"
        onSelect={vi.fn()}
      />,
    );

    const option = screen.getByRole('button', { name: /documents/ });
    expect(within(option).getByText('documents')).not.toHaveStyle({
      color: '#2563EB',
    });
  });
});
