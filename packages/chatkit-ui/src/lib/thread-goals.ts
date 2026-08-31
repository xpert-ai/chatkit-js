import type {
  ChatKitGoalAdapter,
  ThreadGoal,
  ThreadGoalSpec,
  ThreadGoalStatus,
  TThreadGoalClearedEvent,
  TThreadGoalUpdatedEvent,
} from '@xpert-ai/chatkit-types';
import type { RuntimeCapabilitiesSelection } from './runtime-capabilities';

export type GoalCommand =
  | { type: 'show' }
  | { type: 'set'; objective: string }
  | { type: 'edit'; objective: string }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'clear' };

export type GoalCommandResult = {
  threadId?: string;
  goal: ThreadGoal | null;
};

export type ThreadGoalUpdatedPatchEvent = {
  conversationId?: string;
  threadId?: string;
  goalId?: string;
  goal: Partial<ThreadGoal> & { status: ThreadGoalStatus };
  updatedAt: string;
};

function normalizeGoalObjective(value: string): string {
  return value.trim();
}

export function parseGoalCommand(args: string): GoalCommand {
  const text = args.trim();
  if (!text) {
    return { type: 'show' };
  }

  const lower = text.toLowerCase();
  if (lower === 'pause') {
    return { type: 'pause' };
  }
  if (lower === 'resume') {
    return { type: 'resume' };
  }
  if (lower === 'clear') {
    return { type: 'clear' };
  }
  if (lower.startsWith('edit ')) {
    return {
      type: 'edit',
      objective: normalizeGoalObjective(text.slice(5)),
    };
  }
  return {
    type: 'set',
    objective: normalizeGoalObjective(text),
  };
}

export async function loadThreadGoal({
  goal,
  threadId,
  signal,
}: {
  goal: ChatKitGoalAdapter;
  threadId: string;
  signal?: AbortSignal;
}): Promise<ThreadGoal | null> {
  return goal.getGoal({ threadId, signal });
}

export async function executeThreadGoalCommand({
  goal,
  threadId,
  assistantId,
  projectId,
  command,
  runtimeCapabilities,
  signal,
}: {
  goal: ChatKitGoalAdapter;
  threadId?: string | null;
  assistantId: string;
  projectId?: string | null;
  command: GoalCommand;
  runtimeCapabilities?: RuntimeCapabilitiesSelection | null;
  signal?: AbortSignal;
}): Promise<GoalCommandResult> {
  const normalizedThreadId = threadId?.trim() || null;

  if (command.type === 'show') {
    if (!normalizedThreadId) {
      throw new Error('Thread is required to show the current goal.');
    }
    return {
      threadId: normalizedThreadId,
      goal: await goal.getGoal({ threadId: normalizedThreadId, signal }),
    };
  }

  if (command.type === 'clear') {
    if (!normalizedThreadId) {
      throw new Error('Thread is required to clear the current goal.');
    }
    return {
      threadId: normalizedThreadId,
      goal: await goal.clearGoal({ threadId: normalizedThreadId, signal }),
    };
  }

  if (command.type === 'pause' || command.type === 'resume') {
    if (!normalizedThreadId) {
      throw new Error('Thread is required to update the current goal.');
    }
    return {
      threadId: normalizedThreadId,
      goal: await goal.updateGoal({
        threadId: normalizedThreadId,
        status: command.type === 'pause' ? 'paused' : 'active',
        signal,
      }),
    };
  }

  const objective = command.objective.trim();
  if (!objective) {
    throw new Error('Goal objective is required.');
  }

  if (command.type === 'edit') {
    if (!normalizedThreadId) {
      const result = await goal.setGoal({
        threadId: null,
        assistantId,
        projectId,
        objective,
        runtimeCapabilities,
        signal,
      });
      return result;
    }

    return {
      threadId: normalizedThreadId,
      goal: await goal.updateGoal({
        threadId: normalizedThreadId,
        objective,
        signal,
      }),
    };
  }

  const result = await goal.setGoal({
    threadId: normalizedThreadId,
    assistantId,
    projectId,
    objective,
    runtimeCapabilities,
    signal,
  });
  return result;
}

function isGoalStatus(value: unknown): value is ThreadGoalStatus {
  return (
    value === 'active' ||
    value === 'paused' ||
    value === 'blocked' ||
    value === 'usage_limited' ||
    value === 'budget_limited' ||
    value === 'complete'
  );
}

function normalizeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  return 0;
}

function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return null;
  }
  return value;
}

function parseThreadGoalSpec(value: unknown): ThreadGoalSpec | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Partial<ThreadGoalSpec>;
  const successCriteria = parseStringArray(raw.successCriteria);
  const constraints = parseStringArray(raw.constraints);
  const verificationChecklist = parseStringArray(raw.verificationChecklist);

  if (
    typeof raw.originalObjective !== 'string' ||
    typeof raw.executableGoal !== 'string' ||
    !successCriteria ||
    !constraints ||
    !verificationChecklist ||
    typeof raw.recommendedStrategy !== 'string' ||
    (raw.source !== 'system' && raw.source !== 'llm') ||
    typeof raw.generatedAt !== 'string'
  ) {
    return null;
  }

  return {
    originalObjective: raw.originalObjective,
    executableGoal: raw.executableGoal,
    successCriteria,
    constraints,
    verificationChecklist,
    recommendedStrategy: raw.recommendedStrategy,
    source: raw.source,
    generatedAt: raw.generatedAt,
  };
}

export function parseThreadGoal(value: unknown): ThreadGoal | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Partial<ThreadGoal>;
  if (
    typeof raw.threadId !== 'string' ||
    typeof raw.objective !== 'string' ||
    !isGoalStatus(raw.status)
  ) {
    return null;
  }

  return {
    ...(typeof raw.id === 'string' ? { id: raw.id } : {}),
    ...(typeof raw.conversationId === 'string'
      ? { conversationId: raw.conversationId }
      : {}),
    threadId: raw.threadId,
    objective: raw.objective,
    status: raw.status,
    ...(raw.goalSpec === null
      ? { goalSpec: null }
      : (() => {
          const goalSpec = parseThreadGoalSpec(raw.goalSpec);
          return goalSpec ? { goalSpec } : {};
        })()),
    tokensUsed: normalizeNumber(raw.tokensUsed),
    elapsedSeconds: normalizeNumber(raw.elapsedSeconds),
    continuationCount: normalizeNumber(raw.continuationCount),
    ...(raw.statusUpdatedAt !== undefined
      ? { statusUpdatedAt: raw.statusUpdatedAt }
      : {}),
    ...(raw.completedAt !== undefined ? { completedAt: raw.completedAt } : {}),
    ...(raw.blockedAt !== undefined ? { blockedAt: raw.blockedAt } : {}),
  };
}

export function parseThreadGoalUpdatedEvent(
  value: unknown,
): TThreadGoalUpdatedEvent | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Partial<TThreadGoalUpdatedEvent>;
  if (raw.type !== 'thread_goal_updated') {
    return null;
  }
  const goal = parseThreadGoal(raw.goal);
  if (!goal) {
    return null;
  }
  return {
    type: 'thread_goal_updated',
    ...(typeof raw.conversationId === 'string'
      ? { conversationId: raw.conversationId }
      : {}),
    threadId: goal.threadId,
    goal,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
  };
}

export function parseThreadGoalUpdatedPatchEvent(
  value: unknown,
): ThreadGoalUpdatedPatchEvent | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Partial<TThreadGoalUpdatedEvent>;
  if (raw.type !== 'thread_goal_updated') {
    return null;
  }
  const rawGoal = raw.goal;
  if (!rawGoal || typeof rawGoal !== 'object') {
    return null;
  }
  const goal = rawGoal as Partial<ThreadGoal>;
  if (!isGoalStatus(goal.status)) {
    return null;
  }
  const goalPatch: Partial<ThreadGoal> & { status: ThreadGoalStatus } = {
    status: goal.status,
    ...(typeof goal.id === 'string' ? { id: goal.id } : {}),
    ...(typeof goal.conversationId === 'string'
      ? { conversationId: goal.conversationId }
      : {}),
    ...(typeof goal.threadId === 'string' ? { threadId: goal.threadId } : {}),
    ...(typeof goal.objective === 'string'
      ? { objective: goal.objective }
      : {}),
    ...(goal.goalSpec === null
      ? { goalSpec: null }
      : (() => {
          const goalSpec = parseThreadGoalSpec(goal.goalSpec);
          return goalSpec ? { goalSpec } : {};
        })()),
    ...(typeof goal.tokensUsed === 'number'
      ? { tokensUsed: normalizeNumber(goal.tokensUsed) }
      : {}),
    ...(typeof goal.elapsedSeconds === 'number'
      ? { elapsedSeconds: normalizeNumber(goal.elapsedSeconds) }
      : {}),
    ...(typeof goal.continuationCount === 'number'
      ? { continuationCount: normalizeNumber(goal.continuationCount) }
      : {}),
    ...(goal.statusUpdatedAt !== undefined
      ? { statusUpdatedAt: goal.statusUpdatedAt }
      : {}),
    ...(goal.completedAt !== undefined
      ? { completedAt: goal.completedAt }
      : {}),
    ...(goal.blockedAt !== undefined ? { blockedAt: goal.blockedAt } : {}),
  };
  const threadId =
    typeof raw.threadId === 'string'
      ? raw.threadId
      : typeof goal.threadId === 'string'
        ? goal.threadId
        : undefined;
  const goalId = typeof goal.id === 'string' ? goal.id : undefined;
  if (!threadId && !goalId) {
    return null;
  }
  return {
    ...(typeof raw.conversationId === 'string'
      ? { conversationId: raw.conversationId }
      : {}),
    ...(threadId ? { threadId } : {}),
    ...(goalId ? { goalId } : {}),
    goal: goalPatch,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
  };
}

export function parseThreadGoalClearedEvent(
  value: unknown,
): TThreadGoalClearedEvent | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Partial<TThreadGoalClearedEvent>;
  if (raw.type !== 'thread_goal_cleared' || typeof raw.threadId !== 'string') {
    return null;
  }
  return {
    type: 'thread_goal_cleared',
    ...(typeof raw.conversationId === 'string'
      ? { conversationId: raw.conversationId }
      : {}),
    threadId: raw.threadId,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
  };
}
