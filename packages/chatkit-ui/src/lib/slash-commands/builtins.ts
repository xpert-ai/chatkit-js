import type { ChatKitSlashCommand } from '@xpert-ai/chatkit-types';

export const BUILTIN_SLASH_COMMANDS: ChatKitSlashCommand[] = [
  {
    name: 'plan',
    label: 'Plan',
    description: 'Toggle plan mode',
    category: 'session',
    argsHint: '[prompt]',
    action: {
      type: 'client_action',
      action: {
        type: 'chatkit.plan.toggle',
      },
    },
  },
  {
    name: 'skills',
    label: 'Skills',
    description: 'Show runtime skills',
    category: 'capabilities',
    action: {
      type: 'client_action',
      action: {
        type: 'chatkit.capabilities.skills',
      },
    },
  },
  {
    name: 'plugins',
    label: 'Plugins',
    description: 'Show runtime plugins',
    category: 'capabilities',
    aliases: ['tools'],
    action: {
      type: 'client_action',
      action: {
        type: 'chatkit.capabilities.plugins',
      },
    },
  },
  {
    name: 'subagents',
    label: 'Sub-agents',
    description: 'Show runtime sub-agents',
    category: 'capabilities',
    aliases: ['agents'],
    action: {
      type: 'client_action',
      action: {
        type: 'chatkit.capabilities.subagents',
      },
    },
  },
];

export const BUILTIN_SLASH_COMMAND_NAMES = new Set(
  BUILTIN_SLASH_COMMANDS.map((command) => command.name),
);
