import type { LocalizedText } from './localized-text';

export type ChatKitSlashCommandExecutionType =
  | 'insert_text'
  | 'insert_invocation'
  | 'submit_prompt'
  | 'client_action'
  | 'select_capability';

export type ChatKitSlashCommandKind = 'command' | 'prompt_workflow';

export type ChatKitI18nText = LocalizedText;

export type ChatKitPromptWorkflow = {
  type: 'prompt_workflow';
  name?: string;
  label?: ChatKitI18nText;
  description?: ChatKitI18nText;
  tags?: string[];
};

export type ChatKitSlashCommandCapability =
  | {
      type: 'skill';
      id: string;
    }
  | {
      type: 'plugin';
      id: string;
    }
  | {
      type: 'subAgent';
      id: string;
    };

export type ChatKitSlashCommandAction =
  | {
      type: 'insert_text';
      template: string;
      runtimeCapabilities?: unknown;
    }
  | {
      type: 'insert_invocation';
      template: string;
      runtimeCapabilities?: unknown;
    }
  | {
      type: 'submit_prompt';
      template: string;
      runtimeCapabilities?: unknown;
    }
  | {
      type: 'client_action';
      action: {
        type: string;
        payload?: Record<string, unknown>;
      };
      runtimeCapabilities?: unknown;
    }
  | {
      type: 'select_capability';
      capability: ChatKitSlashCommandCapability;
    };

export type ChatKitSlashCommandAvailability = {
  disabled?: boolean;
  reason?: string;
  [key: string]: unknown;
};

export type ChatKitSlashCommand = {
  /**
   * Command name without the leading slash.
   * Valid names use lowercase letters, digits, hyphens, and underscores.
   */
  name: string;
  label?: ChatKitI18nText;
  description?: ChatKitI18nText;
  icon?: string | Record<string, unknown>;
  category?: string;
  aliases?: string[];
  argsHint?: string;
  availability?: ChatKitSlashCommandAvailability;
  kind?: ChatKitSlashCommandKind;
  workflow?: ChatKitPromptWorkflow;
  action: ChatKitSlashCommandAction;
  source?: Record<string, unknown>;
  meta?: Record<string, unknown>;
};

export type ChatKitCommandSource = {
  type: 'slash_command';
  name: string;
  source: 'builtin' | 'host' | 'runtime';
  executionType: ChatKitSlashCommandExecutionType;
  kind?: ChatKitSlashCommandKind;
  workflow?: ChatKitPromptWorkflow;
};
