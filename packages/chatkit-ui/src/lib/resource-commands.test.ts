import { describe, it, expect } from 'vitest';
import type { RuntimeResourceCommand } from '@xpert-ai/xpert-sdk';
import {
  createComposerTextParts,
  getComposerPlainText,
} from './composer-parts';
import {
  getResourceSkills,
  insertResourceCommand,
  resourceSkillIsSelected,
} from './resource-commands';

export const bomCommand: RuntimeResourceCommand = {
  skill: { bindingId: 'binding', version: 'version-1', skillKey: 'bom' },
  packageName: 'operations',
  description: 'BOM operations',
  command: { subcommands: { import: {}, update: {}, plan: {} } },
};
describe('plugin command skill insertion', () => {
  it('inserts a normal skill chip followed by editable /subcommand text before existing arguments', () => {
    const parts = insertResourceCommand(
      createComposerTextParts('existing arguments'),
      bomCommand,
      'import',
    );
    expect(parts[0]).toMatchObject({
      type: 'capability',
      capability: { type: 'skill', label: 'bom' },
    });
    expect(parts[1]).toEqual({ type: 'text', text: ' /import ' });
    expect(getComposerPlainText(parts)).toBe(' /import existing arguments');
    expect(getResourceSkills(parts)).toEqual([bomCommand.skill]);
  });
  it('replaces the known subcommand prefix without duplicating the chip or discarding user arguments', () => {
    const before = insertResourceCommand(
      createComposerTextParts('keep this'),
      bomCommand,
      'import',
    );
    const parts = insertResourceCommand(before, bomCommand, 'update');
    expect(getResourceSkills(parts)).toEqual([bomCommand.skill]);
    expect(parts.filter((part) => part.type === 'capability')).toHaveLength(1);
    expect(getComposerPlainText(parts)).toBe(' /update keep this');
  });
  it('removes only the slash search and preserves existing arguments when selected from the palette', () => {
    const parts = insertResourceCommand(
      createComposerTextParts('existing /bom/pla'),
      bomCommand,
      'plan',
      { start: 9, end: 17 },
    );
    expect(getComposerPlainText(parts)).toBe(' /plan existing ');
    expect(getResourceSkills(parts)).toEqual([bomCommand.skill]);
  });
  it('keeps a command without subcommands as a plain skill selection', () => {
    const parts = insertResourceCommand([], { ...bomCommand, command: {} });
    expect(getComposerPlainText(parts)).toBe(' ');
    expect(getResourceSkills(parts)).toEqual([bomCommand.skill]);
  });
  it('preserves other chips and distinguishes same-name skills across bindings and versions', () => {
    const before = insertResourceCommand([], bomCommand, 'import');
    const other = {
      ...bomCommand,
      skill: { ...bomCommand.skill, bindingId: 'other' },
    };
    expect(
      getResourceSkills(insertResourceCommand(before, other)),
    ).toHaveLength(2);
    expect(
      resourceSkillIsSelected(bomCommand.skill, {
        revision: 0,
        resources: [{ ...bomCommand.skill, version: 'version-2' }],
      }),
    ).toBe(false);
  });
});
