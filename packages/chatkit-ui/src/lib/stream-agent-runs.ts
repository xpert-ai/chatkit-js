import type React from 'react';

import { upsertAgentRun, type AgentRunInfo } from './agent-runs';

type AgentRunStreamMessage = {
  agentRuns?: AgentRunInfo[];
};

type AgentRunStreamState<TMessage extends AgentRunStreamMessage> = {
  messages?: TMessage[];
};

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
