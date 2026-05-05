import type {
  ChatKitPromptWorkflow,
  ChatKitSlashCommand,
  ChatKitSlashCommandAction,
  ChatKitSlashCommandKind,
} from '@xpert-ai/chatkit-types';

import { BUILTIN_SLASH_COMMANDS } from './builtins';
import {
  SLASH_COMMAND_NAME_PATTERN,
  type ResolvedSlashCommand,
  type SlashCommandSource,
} from './types';

export function normalizeSlashCommandName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const name = value.trim();
  return SLASH_COMMAND_NAME_PATTERN.test(name) ? name : null;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean),
    ),
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeSlashCommandKind(
  value: unknown,
  workflow: ChatKitPromptWorkflow | undefined,
  category: string | undefined,
  actionType: ChatKitSlashCommandAction['type'],
): ChatKitSlashCommandKind {
  if (actionType !== 'submit_prompt' && actionType !== 'insert_invocation') {
    return 'command';
  }

  if (value === 'command' || value === 'prompt_workflow') {
    return value;
  }

  if (workflow || category === 'prompt_workflow') {
    return 'prompt_workflow';
  }

  return 'command';
}

function normalizePromptWorkflow(value: unknown): ChatKitPromptWorkflow | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  if (
    record.type !== undefined &&
    record.type !== null &&
    record.type !== 'prompt_workflow'
  ) {
    return null;
  }

  const tags = normalizeStringList(record.tags);
  const name = normalizeOptionalString(record.name);
  const label = normalizeOptionalString(record.label);
  const description = normalizeOptionalString(record.description);
  return {
    type: 'prompt_workflow',
    ...(name ? { name } : {}),
    ...(label ? { label } : {}),
    ...(description ? { description } : {}),
    ...(tags.length ? { tags } : {}),
  };
}

function createPromptWorkflow({
  command,
  name,
  label,
  description,
}: {
  command: ChatKitSlashCommand;
  name: string;
  label: string;
  description?: string;
}): ChatKitPromptWorkflow | undefined {
  const explicitWorkflow = normalizePromptWorkflow(command.workflow);
  const category = normalizeOptionalString(command.category);
  const kind = normalizeSlashCommandKind(
    command.kind,
    explicitWorkflow ?? undefined,
    category,
    command.action.type,
  );
  if (kind !== 'prompt_workflow') {
    return undefined;
  }

  return {
    type: 'prompt_workflow',
    name: explicitWorkflow?.name ?? name,
    label: explicitWorkflow?.label ?? label,
    ...(explicitWorkflow?.description ?? description
      ? { description: explicitWorkflow?.description ?? description }
      : {}),
    ...(explicitWorkflow?.tags?.length ? { tags: explicitWorkflow.tags } : {}),
  };
}

export function isSlashCommandAction(
  value: unknown,
): value is ChatKitSlashCommandAction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const action = value as { type?: unknown; template?: unknown };
  if (
    action.type === 'insert_text' ||
    action.type === 'insert_invocation' ||
    action.type === 'submit_prompt'
  ) {
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
    const label = normalizeOptionalString(command.label) ?? name;
    const description = normalizeOptionalString(command.description);
    const category = normalizeOptionalString(command.category);
    const workflow = createPromptWorkflow({
      command,
      name,
      label,
      description,
    });
    const kind = normalizeSlashCommandKind(
      command.kind,
      workflow,
      category,
      command.action.type,
    );
    result.push({
      id: `${source}:${name}`,
      name,
      label,
      description,
      source,
      action: command.action,
      category,
      aliases: normalizeStringList(command.aliases),
      argsHint: normalizeOptionalString(command.argsHint),
      icon: command.icon,
      availability: command.availability,
      kind,
      workflow,
    });
  };

  BUILTIN_SLASH_COMMANDS.forEach((command) => append(command, 'builtin'));
  (hostCommands ?? []).forEach((command) => append(command, 'host'));
  (runtimeCommands ?? []).forEach((command) => append(command, 'runtime'));

  return result;
}
