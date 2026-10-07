import { mergeAgentRunInfo, type AgentRunInfo } from '../../../lib/agent-runs';
import type { StateType } from '../types';

/** Update every segment of the existing execution; never replace streaming content or the parent run. */
export function reconcileAgentRun(
  state: StateType,
  run: AgentRunInfo,
): StateType {
  return {
    ...state,
    messages: state.messages.map((message) =>
      message.agentRuns?.some((item) => item.id === run.id)
        ? {
            ...message,
            agentRuns: message.agentRuns.map((item) =>
              item.id === run.id ? mergeAgentRunInfo(item, run) : item,
            ),
          }
        : message,
    ),
  };
}
