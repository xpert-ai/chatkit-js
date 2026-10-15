import type {
  RuntimeResourceCommand,
  RuntimeResourceSkillReference,
  RuntimeResourcesSelection,
} from '@xpert-ai/xpert-sdk';
import {
  createComposerCapabilityPart,
  createComposerTextParts,
  replaceComposerRange,
  type ComposerPart,
} from './composer-parts';
import type { RuntimeCapabilityOption } from './runtime-capabilities';
import { resolveLocalizedText } from '../i18n/localized-text';

export type ResourceCommandEntry = {
  id: string;
  name: string;
  label: string;
  description: string;
  item: RuntimeResourceCommand;
  subcommand?: string;
};

/** Share presentation and identities between the start screen and slash palette. */
export function getResourceCommandEntries(
  commands: RuntimeResourceCommand[],
  language?: string,
): ResourceCommandEntry[] {
  return commands.flatMap((item) => {
    const commandLabel =
      resolveLocalizedText(item.command.label, language) ?? item.skill.skillKey;
    const children = Object.entries(item.command.subcommands ?? {});
    const entries = children.length
      ? children
      : [[undefined, item.command] as const];
    return entries.map(([subcommand, meta]) => ({
      id: `${resourceSkillId(item.skill)}/${subcommand ?? ''}`,
      name: subcommand
        ? `${item.skill.skillKey}/${subcommand}`
        : item.skill.skillKey,
      label: subcommand
        ? `${commandLabel}/${resolveLocalizedText(meta.label, language) ?? subcommand}`
        : commandLabel,
      description: [
        item.packageName,
        resolveLocalizedText(meta.description, language) ??
          resolveLocalizedText(item.command.description, language) ??
          item.description,
        meta.argsHint,
      ]
        .filter(Boolean)
        .join(' · '),
      item,
      subcommand,
    }));
  });
}

export function resourceSkillId(skill: RuntimeResourceSkillReference): string {
  return `resource-skill:${skill.bindingId}:${skill.version}:${skill.skillKey}`;
}

export function resourceSkillOption(
  item: RuntimeResourceCommand,
): RuntimeCapabilityOption {
  const id = resourceSkillId(item.skill);
  return {
    type: 'skill',
    id,
    label: item.skill.skillKey,
    description: item.description,
    capability: {
      id,
      workspaceId: '',
      label: item.skill.skillKey,
      description: item.description,
      repositoryName: item.packageName,
      resource: item.skill,
    },
  };
}

export function getResourceSkillOptions(
  parts: ComposerPart[],
): RuntimeCapabilityOption[] {
  const unique = new Map<string, RuntimeCapabilityOption>();
  for (const part of parts) {
    if (
      part.type === 'capability' &&
      part.capability.type === 'skill' &&
      part.capability.capability.resource
    )
      unique.set(part.capability.id, part.capability);
  }
  return [...unique.values()];
}

export function getResourceSkills(
  parts: ComposerPart[],
): RuntimeResourceSkillReference[] {
  return getResourceSkillOptions(parts).flatMap((option) =>
    option.type === 'skill' && option.capability.resource
      ? [option.capability.resource]
      : [],
  );
}

export function resourceSkillIsSelected(
  skill: RuntimeResourceSkillReference,
  selection: RuntimeResourcesSelection,
): boolean {
  return selection.resources.some(
    (ref) => ref.bindingId === skill.bindingId && ref.version === skill.version,
  );
}

/** Keep the normal skill chip; its subcommand is editable ordinary text, never a token. */
export function insertResourceCommand(
  parts: ComposerPart[],
  item: RuntimeResourceCommand,
  subcommand?: string,
  range?: { start: number; end: number },
): ComposerPart[] {
  if (range) parts = replaceComposerRange(parts, range.start, range.end, []);
  const option = resourceSkillOption(item);
  const index = parts.findIndex(
    (part) => part.type === 'capability' && part.capability.id === option.id,
  );
  const before = index < 0 ? [] : parts.slice(0, index);
  const after = index < 0 ? [...parts] : parts.slice(index + 1);
  const first = after[0];
  // Switching a shortcut changes only a known generated prefix, retaining the user's arguments.
  if (index >= 0 && first?.type === 'text') {
    const match = /^\s*\/([a-z0-9-]+)(?=\s|$)\s*/.exec(first.text);
    if (match && Object.hasOwn(item.command.subcommands ?? {}, match[1]))
      after[0] = { type: 'text', text: first.text.slice(match[0].length) };
  }
  return [
    ...before,
    createComposerCapabilityPart(option, option.id),
    ...createComposerTextParts(subcommand ? ` /${subcommand} ` : ' '),
    ...after,
  ];
}
