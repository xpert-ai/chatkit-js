import type { LocalizedText } from './localized-text.js';
import type { ToolOutputImageAttachment } from './tool-output.js';

/** Presentation semantics, independent of component routing and execution status. */
export const TOOL_ACTIVITY_ACTIONS = {
  skill: ['read'],
  image: ['view'],
  file: ['read', 'write', 'list', 'search', 'delete', 'move', 'copy'],
  data: ['discover', 'query', 'validate', 'register'],
  browser: ['navigate', 'read', 'interact', 'capture'],
  command: ['execute'],
  search: ['search'],
  content: ['create', 'update', 'save', 'read', 'list'],
  task: ['create', 'update', 'read'],
} as const;

export type ToolActivityKind = keyof typeof TOOL_ACTIVITY_ACTIONS;
export type ToolActivity = {
  [K in ToolActivityKind]: {
    kind: K;
    action: (typeof TOOL_ACTIVITY_ACTIONS)[K][number];
  };
}[ToolActivityKind];

export function isToolActivity(value: unknown): value is ToolActivity {
  if (
    !value ||
    typeof value !== 'object' ||
    !('kind' in value) ||
    !('action' in value)
  )
    return false;
  if (Object.keys(value).some((key) => key !== 'kind' && key !== 'action'))
    return false;
  if (typeof value.kind !== 'string' || typeof value.action !== 'string')
    return false;
  if (!Object.prototype.hasOwnProperty.call(TOOL_ACTIVITY_ACTIONS, value.kind))
    return false;
  const actions: readonly string[] =
    TOOL_ACTIVITY_ACTIONS[value.kind as ToolActivityKind];
  return actions.includes(value.action);
}

export type ToolDetailPhase = 'input' | 'output' | 'error';
export type ToolDetailReference = {
  conversationId: string;
  executionId: string;
  toolCallId: string;
  phase: ToolDetailPhase;
  id: string;
  sha256: string;
};

/** The input/output/error fields carry only the bounded preview for new events. */
export type ToolValuePresentation = {
  state: 'available' | 'not-public' | 'unavailable';
  format?: 'text' | 'json';
  summary?: LocalizedText;
  byteLength?: number;
  lineCount?: number;
  itemCount?: number;
  truncated: boolean;
  mode?: 'preview' | 'summary';
  detail?: ToolDetailReference;
};

export type ToolCallPresentation = {
  version: 1;
  activity?: ToolActivity;
  target?: string;
  /** Explicit participant-visible immutable images; never inferred from private artifacts. */
  images?: ToolOutputImageAttachment[];
  input?: ToolValuePresentation;
  output?: ToolValuePresentation;
  error?: ToolValuePresentation;
};

/** No localized text or tool names participate in aggregation. Order is first occurrence. */
export function summarizeToolActivities(
  activities: ReadonlyArray<ToolActivity | undefined>,
) {
  const kinds: ToolActivityKind[] = [];
  const actions = new Map<ToolActivityKind, Set<string>>();
  let unknown = false;
  for (const activity of activities) {
    if (!activity) {
      unknown = true;
      continue;
    }
    let set = actions.get(activity.kind);
    if (!set) {
      kinds.push(activity.kind);
      set = new Set();
      actions.set(activity.kind, set);
    }
    set.add(activity.action);
  }
  const kind = kinds.length === 1 && !unknown ? kinds[0] : undefined;
  const actionSet = kind ? actions.get(kind) : undefined;
  return {
    kinds,
    unknown,
    kind,
    action: actionSet?.size === 1 ? [...actionSet][0] : undefined,
    mixed: kinds.length > 1 || (kinds.length > 0 && unknown),
  };
}
