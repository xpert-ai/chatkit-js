import type {
  RuntimeCapabilitiesResponse,
  RuntimeCapabilitiesSelection,
} from '@xpert-ai/xpert-sdk';
import type {
  ChatKitCommandSource,
  ChatKitPromptWorkflow,
  ChatKitSlashCommand,
  ChatKitSlashCommandAction,
  ChatKitSlashCommandCapability,
  ChatKitSlashCommandKind,
} from '@xpert-ai/chatkit-types';

import type { RuntimeCapabilityOption } from '../runtime-capabilities';

export type RuntimeCapabilitiesWithCommands = RuntimeCapabilitiesResponse & {
  commands?: ChatKitSlashCommand[];
};

export type RuntimeCapabilityPaletteState = {
  query: string;
  start: number;
  end: number;
  activeIndex: number;
  atMessageStart: boolean;
  capabilityTypes?: RuntimeCapabilityOption['type'][];
  expandedCapabilityTypes?: RuntimeCapabilityOption['type'][];
};

export type SlashCommandSource = 'builtin' | 'host' | 'runtime';

export type ResolvedSlashCommand = {
  id: string;
  name: string;
  label: string;
  description?: string;
  source: SlashCommandSource;
  action: ChatKitSlashCommandAction;
  category?: string;
  aliases: string[];
  argsHint?: string;
  icon?: ChatKitSlashCommand['icon'];
  availability?: ChatKitSlashCommand['availability'];
  kind: ChatKitSlashCommandKind;
  workflow?: ChatKitPromptWorkflow;
};

export type SlashPaletteOption =
  | {
      kind: 'command';
      id: string;
      label: string;
      description?: string;
      command: ResolvedSlashCommand;
      capabilityType?: RuntimeCapabilityOption['type'];
      expanded?: boolean;
      childCount?: number;
    }
  | {
      kind: 'capability';
      id: string;
      label: string;
      description?: string;
      capability: RuntimeCapabilityOption;
      parentType?: RuntimeCapabilityOption['type'];
      depth?: number;
    };

export type CommandExecutionEffect =
  | { type: 'none' }
  | { type: 'toggle_plan'; clearComposer?: boolean }
  | {
      type: 'submit_prompt';
      inputText: string;
      displayText: string;
      commandSource: ChatKitCommandSource;
      runtimeCapabilities?: RuntimeCapabilitiesSelection;
      planMode?: boolean;
    }
  | {
      type: 'set_composer_text';
      text: string;
      caretOffset?: number;
      runtimeCapabilities?: RuntimeCapabilitiesSelection;
    }
  | {
      type: 'show_capabilities';
      capabilityTypes: RuntimeCapabilityOption['type'][];
    }
  | {
      type: 'select_capability';
      capability: ChatKitSlashCommandCapability;
    }
  | {
      type: 'client_action';
      command: ResolvedSlashCommand;
      action: Extract<ChatKitSlashCommandAction, { type: 'client_action' }>;
    };

export const SLASH_COMMAND_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
