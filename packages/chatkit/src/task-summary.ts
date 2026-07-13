export const CHATKIT_TASK_SUMMARY_OPEN_RESOURCE_EFFECT =
  'task_summary.open_resource' as const;

export type ChatTaskSummaryResourceReference =
  | {
      type: 'message';
      messageId: string;
    }
  | {
      type: 'workspace_file';
      workspacePath: string;
      fileAssetId?: string;
      storageFileId?: string;
    }
  | {
      type: 'artifact';
      artifactId: string;
    }
  | {
      type: 'browser';
      serviceId?: string;
      url?: string;
    }
  | {
      type: 'url';
      url: string;
    };

export type ChatTaskSummaryOutputKind =
  | 'file'
  | 'image'
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'site'
  | 'url'
  | 'mcp_app';

export type ChatTaskSummaryOutputStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'error';

export type ChatTaskSummaryOutput = {
  id: string;
  kind: ChatTaskSummaryOutputKind;
  title: string;
  description?: string;
  status?: ChatTaskSummaryOutputStatus;
  resource?: ChatTaskSummaryResourceReference;
  messageId?: string;
  updatedAt?: string;
};

export type ChatTaskSummarySourceKind =
  | 'attachment'
  | 'code'
  | 'quote'
  | 'image'
  | 'web_page'
  | 'file_element'
  | 'knowledge'
  | 'skill'
  | 'plugin'
  | 'sub_agent';

export type ChatTaskSummarySource = {
  id: string;
  kind: ChatTaskSummarySourceKind;
  title: string;
  description?: string;
  resource?: ChatTaskSummaryResourceReference;
  messageId?: string;
  updatedAt?: string;
};

export type ChatTaskSummaryPlan = {
  title: string;
  excerpt: string;
  messageId?: string;
  updatedAt?: string;
};

export type ChatTaskSummaryTodoStatus = 'pending' | 'in_progress' | 'completed';

export type ChatTaskSummaryTodoItem = {
  id: string;
  content: string;
  status: ChatTaskSummaryTodoStatus;
};

export type ChatTaskSummaryTodos = {
  componentId: string;
  title?: string;
  items: ChatTaskSummaryTodoItem[];
  messageId?: string;
  updatedAt?: string;
};

/**
 * Compact, persisted contribution from one chat message to a thread summary.
 * Raw tool output, logs, inputs, and environment values must never be copied here.
 */
export type TChatTaskSummaryContribution = {
  version: 1;
  plan?: ChatTaskSummaryPlan;
  todos?: ChatTaskSummaryTodos;
  outputs?: ChatTaskSummaryOutput[];
  sources?: ChatTaskSummarySource[];
};

export type ChatTaskSummaryOpenResourceEffect = {
  resource: ChatTaskSummaryResourceReference;
  conversationId?: string;
  messageId?: string;
  title?: string;
};
