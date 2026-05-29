import type {
  ChatKitCommandSource,
  ChatKitPromptWorkflow,
  ChatKitSlashCommandAction,
} from '@xpert-ai/chatkit-types';

import { isRuntimeCapabilitiesSelection } from '../message-metadata';
import { resolveLocalizedText } from '../../i18n/localized-text';
import type { CommandExecutionEffect, ResolvedSlashCommand } from './types';

function resolvePetCommandMode(
  args: string,
): 'toggle' | 'on' | 'off' | 'settings' {
  const normalized = args.trim().toLowerCase();
  if (!normalized) {
    return 'toggle';
  }

  if (['on', 'enable', 'enabled', 'true'].includes(normalized)) {
    return 'on';
  }

  if (['off', 'disable', 'disabled', 'false'].includes(normalized)) {
    return 'off';
  }

  if (['settings', 'setting', 'config', 'configure'].includes(normalized)) {
    return 'settings';
  }

  return 'toggle';
}

export function renderSlashCommandTemplate(
  template: string,
  args: string,
  options?: { trim?: boolean },
): string {
  const rendered = template.replace(/\{\{\s*args\s*\}\}/g, args);
  return options?.trim === false ? rendered : rendered.trim();
}

export function getActionRuntimeCapabilities(
  action: ChatKitSlashCommandAction,
) {
  return 'runtimeCapabilities' in action &&
    isRuntimeCapabilitiesSelection(action.runtimeCapabilities)
    ? action.runtimeCapabilities
    : null;
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

export function shouldSubmitRawSlashInvocation(
  command: ResolvedSlashCommand,
): boolean {
  if (command.name === 'goal' && command.source === 'runtime') {
    return false;
  }
  return command.action.type === 'insert_invocation';
}

function resolvePromptWorkflowText(
  value: unknown,
  language?: string | null,
): string | undefined {
  return resolveLocalizedText(value, language ?? undefined) ?? undefined;
}

function resolveWorkflowTags(workflow: ChatKitPromptWorkflow | undefined) {
  return Array.isArray(workflow?.tags) && workflow.tags.length
    ? workflow.tags
    : undefined;
}

function resolveCommandSourceWorkflow(
  command: ResolvedSlashCommand,
  language?: string | null,
): ChatKitPromptWorkflow | undefined {
  if (command.kind !== 'prompt_workflow') {
    return undefined;
  }

  const workflow = command.workflow;
  const label = resolvePromptWorkflowText(workflow?.label, language);
  const description =
    resolvePromptWorkflowText(workflow?.description, language) ??
    resolvePromptWorkflowText(command.description, language);
  const name = workflow?.name?.trim() || command.name;
  const fallbackLabel =
    resolvePromptWorkflowText(command.label, language) ?? command.name;
  const tags = resolveWorkflowTags(workflow);
  return {
    type: 'prompt_workflow',
    name,
    label: label ?? fallbackLabel,
    ...(description ? { description } : {}),
    ...(tags ? { tags } : {}),
  };
}

export function createSlashCommandExecutionEffect(
  command: ResolvedSlashCommand,
  args: string,
  language?: string | null,
): CommandExecutionEffect {
  const action = command.action;
  const workflow = resolveCommandSourceWorkflow(command, language);
  const commandSource: ChatKitCommandSource = {
    type: 'slash_command' as const,
    name: command.name,
    source: command.source,
    executionType: action.type,
    ...(command.kind === 'prompt_workflow' ? { kind: command.kind } : {}),
    ...(workflow ? { workflow } : {}),
  };

  if (command.name === 'goal' && command.source === 'runtime') {
    return {
      type: 'goal',
      args: args.trim(),
      commandSource,
      runtimeCapabilities: getActionRuntimeCapabilities(action) ?? undefined,
    };
  }

  if (command.source === 'builtin' && action.type === 'client_action') {
    if (command.name === 'plan') {
      if (args.trim()) {
        return {
          type: 'submit_prompt',
          inputText: args.trim(),
          displayText: args.trim(),
          commandSource,
          planMode: true,
        };
      }
      return { type: 'toggle_plan', clearComposer: true };
    }

    if (command.name === 'skills') {
      return { type: 'show_capabilities', capabilityTypes: ['skill'] };
    }

    if (command.name === 'plugins') {
      return { type: 'show_capabilities', capabilityTypes: ['plugin'] };
    }

    if (command.name === 'subagents') {
      return { type: 'show_capabilities', capabilityTypes: ['subAgent'] };
    }

    if (command.name === 'pet') {
      return {
        type: 'pet',
        mode: resolvePetCommandMode(args),
        clearComposer: true,
      };
    }
  }

  if (action.type === 'select_capability') {
    return {
      type: 'select_capability',
      capability: action.capability,
    };
  }

  if (action.type === 'insert_text' || action.type === 'insert_invocation') {
    return {
      type: 'set_composer_text',
      text: renderSlashCommandTemplate(action.template, args, { trim: false }),
      runtimeCapabilities: getActionRuntimeCapabilities(action) ?? undefined,
    };
  }

  if (action.type === 'submit_prompt') {
    const rendered = renderSlashCommandTemplate(action.template, args);
    if (!rendered) {
      return { type: 'none' };
    }
    return {
      type: 'submit_prompt',
      inputText: rendered,
      displayText: rendered,
      commandSource,
      runtimeCapabilities: getActionRuntimeCapabilities(action) ?? undefined,
    };
  }

  if (action.type === 'client_action') {
    return {
      type: 'client_action',
      command,
      action,
    };
  }

  return { type: 'none' };
}
