import type React from 'react';

import { upsertAgentRun, type AgentRunInfo } from './agent-runs';

type AgentRunStreamMessage = {
  agentRuns?: AgentRunInfo[];
  executionId?: string;
  status?: string;
  type?: string;
};

type AgentRunStreamState<TMessage extends AgentRunStreamMessage> = {
  messages?: TMessage[];
};

export function interruptRunningAgentRuns(
  runs: AgentRunInfo[] | undefined,
  interruptedAt = Date.now(),
) {
  if (!runs) return undefined;

  const endedAt = new Date(interruptedAt).toISOString();
  return runs.map((run) => {
    if (run.status?.trim().toLowerCase() !== 'running') {
      return run;
    }

    const startedAt = Date.parse(run.startedAt ?? run.createdAt ?? '');
    const elapsedTime =
      typeof run.elapsedTime === 'number' && Number.isFinite(run.elapsedTime)
        ? run.elapsedTime
        : Number.isNaN(startedAt)
          ? undefined
          : Math.max(0, interruptedAt - startedAt);

    return {
      ...run,
      status: 'interrupted',
      endedAt,
      updatedAt: endedAt,
      ...(elapsedTime !== undefined ? { elapsedTime } : {}),
    };
  });
}

export function interruptActiveAgentRunOnMessages<
  TMessage extends AgentRunStreamMessage,
>(
  messages: TMessage[],
  {
    activeRunId,
    hasActiveRun,
    interruptedAt = Date.now(),
  }: {
    activeRunId?: string | null;
    hasActiveRun: boolean;
    interruptedAt?: number;
  },
): TMessage[] {
  if (!hasActiveRun) return messages;

  const normalizedActiveRunId = activeRunId?.trim();
  let targetIndex = -1;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const type = message.type?.trim().toLowerCase();
    if (type !== 'ai' && type !== 'assistant') continue;

    const hasRunningAgentRun = message.agentRuns?.some(
      (run) => run.status?.trim().toLowerCase() === 'running',
    );
    const matchesActiveRun =
      Boolean(normalizedActiveRunId) &&
      message.executionId?.trim() === normalizedActiveRunId;

    if (hasRunningAgentRun || matchesActiveRun) {
      targetIndex = index;
      break;
    }
  }

  if (targetIndex < 0) return messages;

  const nextMessages = [...messages];
  const targetMessage = nextMessages[targetIndex];
  nextMessages[targetIndex] = {
    ...targetMessage,
    status: 'aborted',
    agentRuns: interruptRunningAgentRuns(
      targetMessage.agentRuns,
      interruptedAt,
    ),
  };
  return nextMessages;
}

export function upsertAgentRunOnLatestMessage<
  TMessage extends AgentRunStreamMessage,
  TState extends AgentRunStreamState<TMessage>,
>(
  setValues: React.Dispatch<React.SetStateAction<TState>>,
  run: AgentRunInfo,
  findLatestAssistantMessageIndex: (messages: TMessage[]) => number,
  createEmptyAssistantMessage: (run: AgentRunInfo) => TMessage,
) {
  setValues((prev) => {
    const messages = prev.messages ?? [];
    const lastAssistantIndex = findLatestAssistantMessageIndex(messages);

    if (lastAssistantIndex < 0) {
      return {
        ...prev,
        messages: [...messages, createEmptyAssistantMessage(run)],
      };
    }

    const nextMessages = [...messages];
    const last = nextMessages[lastAssistantIndex];
    nextMessages[lastAssistantIndex] = {
      ...last,
      agentRuns: upsertAgentRun(last.agentRuns, run),
    };
    return { ...prev, messages: nextMessages };
  });
}
