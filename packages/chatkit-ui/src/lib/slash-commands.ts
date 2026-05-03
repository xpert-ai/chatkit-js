import type {
  RuntimeCapabilitiesResponse,
  RuntimeCapabilitiesSelection,
} from '@xpert-ai/xpert-sdk';
import type {
  ChatKitSlashCommand,
  ChatKitSlashCommandAction,
} from '@xpert-ai/chatkit-types';

import {
  createEmptyRuntimeCapabilitiesSelection,
  isRuntimeCapabilitySelected,
  type RuntimeCapabilityOption,
} from './runtime-capabilities';
import { isRuntimeCapabilitiesSelection } from './message-metadata';

export type RuntimeCapabilitiesWithCommands = RuntimeCapabilitiesResponse & {
  commands?: ChatKitSlashCommand[];
};

export type RuntimeCapabilityPaletteState = {
  query: string;
  start: number;
  end: number;
  activeIndex: number;
  atMessageStart: boolean;
  commandListOnly?: boolean;
};

export type SlashCommandSource = 'builtin' | 'host' | 'runtime';

export type ResolvedSlashCommand = {
  id: string;
  name: string;
  label: string;
  description?: string;
  source: SlashCommandSource;
  action: ChatKitSlashCommandAction;
};

export type SlashPaletteOption =
  | {
      kind: 'command';
      id: string;
      label: string;
      description?: string;
      command: ResolvedSlashCommand;
    }
  | {
      kind: 'capability';
      id: string;
      label: string;
      description?: string;
      capability: RuntimeCapabilityOption;
    };

const SLASH_COMMAND_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

const BUILTIN_SLASH_COMMANDS: ChatKitSlashCommand[] = [
  {
    name: 'plan',
    label: 'Plan',
    description: 'Toggle plan mode',
    action: {
      type: 'client_action',
      action: {
        type: 'chatkit.plan.toggle',
      },
    },
  },
  {
    name: 'clear',
    label: 'Clear',
    description: 'Clear the composer',
    action: {
      type: 'client_action',
      action: {
        type: 'chatkit.composer.clear',
      },
    },
  },
  {
    name: 'help',
    label: 'Help',
    description: 'Show slash commands',
    action: {
      type: 'client_action',
      action: {
        type: 'chatkit.slash.help',
      },
    },
  },
];

export function resolveRuntimeCapabilityPalette(
  value: string,
  selectionStart: number | null | undefined,
): RuntimeCapabilityPaletteState | null {
  if (typeof selectionStart !== 'number') {
    return null;
  }

  const beforeCaret = value.slice(0, selectionStart);
  const match = /(^|\s)\/([^\s/]*)$/.exec(beforeCaret);
  if (!match) {
    return null;
  }

  const query = match[2] ?? '';
  const start = beforeCaret.length - query.length - 1;
  const beforeTrigger = beforeCaret.slice(0, start);
  return {
    query,
    start,
    end: selectionStart,
    activeIndex: 0,
    atMessageStart: beforeTrigger.trim().length === 0,
  };
}

function normalizeSlashCommandName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const name = value.trim();
  return SLASH_COMMAND_NAME_PATTERN.test(name) ? name : null;
}

function isSlashCommandAction(
  value: unknown,
): value is ChatKitSlashCommandAction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const action = value as { type?: unknown; template?: unknown };
  if (action.type === 'insert_text' || action.type === 'submit_prompt') {
    return typeof action.template === 'string' && action.template.length > 0;
  }

  if (action.type === 'client_action') {
    const clientAction = (value as { action?: unknown }).action;
    return (
      !!clientAction &&
      typeof clientAction === 'object' &&
      !Array.isArray(clientAction) &&
      typeof (clientAction as { type?: unknown }).type === 'string'
    );
  }

  if (action.type === 'select_capability') {
    const capability = (value as { capability?: unknown }).capability;
    if (!capability || typeof capability !== 'object') {
      return false;
    }
    const candidate = capability as { type?: unknown; id?: unknown };
    return (
      ['skill', 'plugin', 'subAgent'].includes(String(candidate.type)) &&
      typeof candidate.id === 'string' &&
      candidate.id.trim().length > 0
    );
  }

  return false;
}

export function resolveSlashCommands(
  hostCommands: ChatKitSlashCommand[] | undefined,
  runtimeCommands: ChatKitSlashCommand[] | undefined,
): ResolvedSlashCommand[] {
  const result: ResolvedSlashCommand[] = [];
  const seen = new Set<string>();

  const append = (command: ChatKitSlashCommand, source: SlashCommandSource) => {
    const name = normalizeSlashCommandName(command.name);
    if (!name || !isSlashCommandAction(command.action)) {
      return;
    }

    if (seen.has(name)) {
      console.warn(`[Chat] Ignoring duplicate slash command "${name}".`);
      return;
    }

    seen.add(name);
    result.push({
      id: `${source}:${name}`,
      name,
      label: command.label?.trim() || name,
      description: command.description?.trim() || undefined,
      source,
      action: command.action,
    });
  };

  BUILTIN_SLASH_COMMANDS.forEach((command) => append(command, 'builtin'));
  (hostCommands ?? []).forEach((command) => append(command, 'host'));
  (runtimeCommands ?? []).forEach((command) => append(command, 'runtime'));

  return result;
}

export function createSlashPaletteOptions({
  palette,
  resolvedCommands,
  runtimeCapabilitiesReady,
  runtimeCapabilityOptions,
  runtimeCapabilities,
  effectiveRuntimeCapabilitiesForSubmit,
}: {
  palette: RuntimeCapabilityPaletteState | null;
  resolvedCommands: ResolvedSlashCommand[];
  runtimeCapabilitiesReady: boolean;
  runtimeCapabilityOptions: RuntimeCapabilityOption[];
  runtimeCapabilities: RuntimeCapabilitiesWithCommands | null;
  effectiveRuntimeCapabilitiesForSubmit: RuntimeCapabilitiesSelection | null;
}): SlashPaletteOption[] {
  if (!palette) {
    return [];
  }

  const query = palette.query.trim().toLowerCase();
  const commandOptions: SlashPaletteOption[] =
    palette.atMessageStart || palette.commandListOnly
      ? resolvedCommands
          .filter((command) => {
            if (!query) {
              return true;
            }
            return [command.name, command.label, command.description]
              .filter(Boolean)
              .some((value) => value?.toLowerCase().includes(query));
          })
          .map((command) => ({
            kind: 'command' as const,
            id: command.id,
            label: command.label,
            description: command.description,
            command,
          }))
      : [];
  const capabilityOptions: SlashPaletteOption[] = runtimeCapabilitiesReady
    ? runtimeCapabilityOptions
        .filter(
          (option) =>
            !palette.commandListOnly &&
            !isRuntimeCapabilitySelected(
              effectiveRuntimeCapabilitiesForSubmit ??
                createEmptyRuntimeCapabilitiesSelection(runtimeCapabilities),
              option.type,
              option.id,
            ),
        )
        .filter((option) => {
          if (!query) {
            return true;
          }
          return [option.label, option.description, option.type]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(query));
        })
        .map((capability) => ({
          kind: 'capability' as const,
          id: `${capability.type}:${capability.id}`,
          label: capability.label,
          description: capability.description,
          capability,
        }))
    : [];

  return [...commandOptions, ...capabilityOptions].slice(0, 8);
}

export function parseSlashCommandInvocation(value: string): {
  name: string;
  args: string;
} | null {
  const match = /^\s*\/([a-z0-9][a-z0-9_-]{0,63})(?:\s+([\s\S]*))?$/.exec(
    value,
  );
  if (!match) {
    return null;
  }

  return {
    name: match[1],
    args: match[2]?.trim() ?? '',
  };
}

export function renderSlashCommandTemplate(
  template: string,
  args: string,
): string {
  return template.replace(/\{\{\s*args\s*\}\}/g, args).trim();
}

export function getActionRuntimeCapabilities(
  action: ChatKitSlashCommandAction,
): RuntimeCapabilitiesSelection | null {
  return 'runtimeCapabilities' in action &&
    isRuntimeCapabilitiesSelection(action.runtimeCapabilities)
    ? action.runtimeCapabilities
    : null;
}
