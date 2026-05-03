export type ChatKitSlashCommandExecutionType =
  | 'insert_text'
  | 'submit_prompt'
  | 'client_action'
  | 'select_capability';

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
    }
  | {
      type: 'select_capability';
      capability: ChatKitSlashCommandCapability;
    };

export type ChatKitSlashCommand = {
  /**
   * Command name without the leading slash.
   * Valid names use lowercase letters, digits, hyphens, and underscores.
   */
  name: string;
  label?: string;
  description?: string;
  icon?: string | Record<string, unknown>;
  action: ChatKitSlashCommandAction;
  source?: Record<string, unknown>;
  meta?: Record<string, unknown>;
};

export type ChatKitCommandSource = {
  type: 'slash_command';
  name: string;
  source: 'builtin' | 'host' | 'runtime';
  executionType: ChatKitSlashCommandExecutionType;
};
