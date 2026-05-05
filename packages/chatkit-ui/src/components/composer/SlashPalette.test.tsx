import { render, screen } from '@testing-library/react';
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
});
