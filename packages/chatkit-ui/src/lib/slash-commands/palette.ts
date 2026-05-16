import {
  createEmptyRuntimeCapabilitiesSelection,
  isRuntimeCapabilitySelected,
  type RuntimeCapabilitiesSelection,
  type RuntimeCapabilityOption,
} from '../runtime-capabilities';
import { resolveLocalizedText } from '../../i18n/localized-text';
import type {
  ResolvedSlashCommand,
  RuntimeCapabilitiesWithCommands,
  RuntimeCapabilityPaletteState,
  SlashPaletteOption,
} from './types';

const CAPABILITY_GROUP_COMMANDS: Partial<
  Record<string, RuntimeCapabilityOption['type']>
> = {
  skills: 'skill',
  plugins: 'plugin',
  subagents: 'subAgent',
};

export function resolveRuntimeCapabilityPalette(
  value: string,
  selectionStart: number | null | undefined,
): RuntimeCapabilityPaletteState | null {
  if (typeof selectionStart !== 'number') {
    return null;
  }

  const beforeCaret = value.slice(0, selectionStart);
  const match = /(^|\s)([/$])([^\s/]*)$/.exec(beforeCaret);
  if (!match) {
    return null;
  }

  const trigger = match[2] as '/' | '$';
  const query = match[3] ?? '';
  const start = beforeCaret.length - query.length - 1;
  const beforeTrigger = beforeCaret.slice(0, start);
  return {
    trigger,
    query,
    start,
    end: selectionStart,
    activeIndex: 0,
    atMessageStart: beforeTrigger.trim().length === 0,
    ...(trigger === '$' ? { capabilityTypes: ['skill' as const] } : {}),
  };
}

function matchesQuery(values: Array<string | undefined>, query: string) {
  if (!query) {
    return true;
  }

  return values
    .filter(Boolean)
    .some((value) => value?.toLowerCase().includes(query));
}

function isCommandAvailable(command: ResolvedSlashCommand) {
  return command.availability?.disabled !== true;
}

function resolveCommandText(
  value: unknown,
  language: string | null | undefined,
  fallback?: string,
) {
  return resolveLocalizedText(value, language ?? undefined) ?? fallback;
}

function matchesCommand(
  command: ResolvedSlashCommand,
  query: string,
  language?: string | null,
) {
  return matchesQuery(
    [
      command.name,
      resolveCommandText(command.label, language, command.name),
      resolveCommandText(command.description, language),
      command.category,
      command.argsHint,
      command.kind,
      command.workflow?.name,
      resolveCommandText(command.workflow?.label, language),
      resolveCommandText(command.workflow?.description, language),
      ...(command.workflow?.tags ?? []),
      ...command.aliases,
    ],
    query,
  );
}

function getCommandPaletteDescription(
  command: ResolvedSlashCommand,
  language?: string | null,
) {
  return [
    command.argsHint,
    resolveCommandText(command.description, language),
  ]
    .filter(Boolean)
    .join(' ');
}

function matchesCapability(
  option: RuntimeCapabilityOption,
  query: string,
  capabilityTypes?: RuntimeCapabilityOption['type'][],
) {
  if (capabilityTypes?.length && !capabilityTypes.includes(option.type)) {
    return false;
  }

  const skillAliases =
    option.type === 'skill' ? [`$${option.id}`, `$${option.label}`] : [];
  return matchesQuery(
    [option.id, option.label, option.description, option.type, ...skillAliases],
    query,
  );
}

function getCommandPaletteOption(
  command: ResolvedSlashCommand,
  language?: string | null,
) {
  const capabilityType = CAPABILITY_GROUP_COMMANDS[command.name];
  return {
    kind: 'command' as const,
    id: command.id,
    label: resolveCommandText(command.label, language, command.name) ?? command.name,
    description: getCommandPaletteDescription(command, language),
    command,
    ...(capabilityType ? { capabilityType } : {}),
  };
}

export function createSlashPaletteOptions({
  palette,
  resolvedCommands,
  runtimeCapabilitiesReady,
  runtimeCapabilityOptions,
  runtimeCapabilities,
  recommendedRuntimeCapabilities,
  language,
}: {
  palette: RuntimeCapabilityPaletteState | null;
  resolvedCommands: ResolvedSlashCommand[];
  runtimeCapabilitiesReady: boolean;
  runtimeCapabilityOptions: RuntimeCapabilityOption[];
  runtimeCapabilities: RuntimeCapabilitiesWithCommands | null;
  recommendedRuntimeCapabilities: RuntimeCapabilitiesSelection | null;
  language?: string | null;
}): SlashPaletteOption[] {
  if (!palette) {
    return [];
  }

  const query = palette.query.trim().toLowerCase();
  const capabilityTypesOnly = Boolean(palette.capabilityTypes?.length);
  const expandedCapabilityTypes = new Set(
    palette.expandedCapabilityTypes ?? [],
  );
  const selection =
    recommendedRuntimeCapabilities ??
    createEmptyRuntimeCapabilitiesSelection(runtimeCapabilities);

  const getCapabilityOptions = (
    capabilityTypes?: RuntimeCapabilityOption['type'][],
    capabilityQuery = query,
  ) =>
    runtimeCapabilitiesReady
      ? runtimeCapabilityOptions.filter(
          (option) =>
            matchesCapability(option, capabilityQuery, capabilityTypes) &&
            !isRuntimeCapabilitySelected(selection, option.type, option.id),
        )
      : [];

  const toCapabilityPaletteOption = (
    capability: RuntimeCapabilityOption,
    parentType?: RuntimeCapabilityOption['type'],
  ): SlashPaletteOption => ({
    kind: 'capability' as const,
    id: parentType
      ? `capability-child:${parentType}:${capability.type}:${capability.id}`
      : `${capability.type}:${capability.id}`,
    label: capability.label,
    description: capability.description,
    capability,
    ...(parentType ? { parentType, depth: 1 } : {}),
  });

  if (palette.atMessageStart && !capabilityTypesOnly) {
    const options: SlashPaletteOption[] = [];
    for (const command of resolvedCommands.filter(isCommandAvailable)) {
      const capabilityType = CAPABILITY_GROUP_COMMANDS[command.name];
      if (!capabilityType) {
        if (matchesCommand(command, query, language)) {
          options.push(getCommandPaletteOption(command, language));
        }
        continue;
      }

      const expanded = expandedCapabilityTypes.has(capabilityType);
      const childQuery = expanded ? '' : query;
      const children = getCapabilityOptions([capabilityType], childQuery);
      const commandMatches = matchesCommand(command, query, language);
      const autoExpanded = !expanded && Boolean(query) && children.length > 0;
      if (!commandMatches && !expanded && !autoExpanded) {
        continue;
      }

      options.push({
        ...getCommandPaletteOption(command, language),
        expanded: expanded || autoExpanded,
        childCount: children.length,
      });

      if (expanded || autoExpanded) {
        options.push(
          ...children.map((capability) =>
            toCapabilityPaletteOption(capability, capabilityType),
          ),
        );
      }
    }

    return options;
  }

  return getCapabilityOptions(palette.capabilityTypes).map((capability) =>
    toCapabilityPaletteOption(capability),
  );
}
