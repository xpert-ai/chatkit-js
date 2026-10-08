import { parseResourceCardContent } from '@xpert-ai/chatkit-types';
import type {
  ChatkitMessage,
  TMessageContentComplex,
  TMessageContentReasoning,
  TMessageContentResourceCard,
} from '@xpert-ai/chatkit-types';
import {
  buildAssistantRenderTree,
  type AgentRunRenderNode,
  type AssistantMessageWithAgentRuns,
} from '../../lib/agent-run-render-tree';
import { mergeAgentRunInfo, type AgentRunInfo } from '../../lib/agent-runs';
import type { useStreamContext } from '../../providers/Stream';

export const EXTERNAL_ASSISTANTS_VIEW_KEY =
  'chatkit.native.external-assistants';

export type ExternalAssistantRun = {
  id: string;
  info: AgentRunInfo;
  segments: { node: AgentRunRenderNode; message: ChatkitMessage }[];
};

export function toWorkbenchMessages(
  messages: ReturnType<typeof useStreamContext>['messages'],
): AssistantMessageWithAgentRuns[] {
  return messages.map(
    (message) =>
      ({
        ...message,
        type:
          message.type === 'ai'
            ? 'assistant'
            : message.type === 'human'
              ? 'user'
              : message.type,
      }) as AssistantMessageWithAgentRuns,
  );
}

export function collectExternalAssistantRuns(
  messages: AssistantMessageWithAgentRuns[],
): ExternalAssistantRun[] {
  const runs = new Map<string, ExternalAssistantRun>();
  for (const message of messages) {
    if (
      message.type !== 'assistant' ||
      !message.agentRuns?.some(
        (run) => run.invocationKind === 'external_assistant',
      )
    )
      continue;
    const visit = (node: AgentRunRenderNode) => {
      if (node.info.invocationKind === 'external_assistant') {
        const previous = runs.get(node.id);
        runs.set(node.id, {
          id: node.id,
          info: mergeAgentRunInfo(previous?.info, node.info),
          segments: [...(previous?.segments ?? []), { node, message }],
        });
      }
      node.children.forEach(visit);
    };
    buildAssistantRenderTree(message).units.forEach((unit) => {
      if (unit.type === 'agent') visit(unit.node);
    });
  }
  return [...runs.values()];
}

/** Project one execution into the same message contract used by the main chat. */
export function toExternalAssistantMessages(
  run: ExternalAssistantRun,
): AssistantMessageWithAgentRuns[] {
  const messages: AssistantMessageWithAgentRuns[] = [];
  const inputs = run.info.inputs;
  // External tools accept { input: string, ...customParameters }. Keep custom
  // parameters visible when present, but present a plain prompt as a user turn.
  const inputText =
    inputs == null
      ? ''
      : typeof inputs === 'string'
        ? inputs
        : typeof inputs === 'object' &&
            'input' in inputs &&
            typeof inputs.input === 'string' &&
            Object.keys(inputs).length === 1
          ? inputs.input
          : JSON.stringify(inputs, null, 2);
  if (inputText) {
    messages.push({ id: `${run.id}:input`, type: 'user', content: inputText });
  }

  for (const { node, message } of run.segments) {
    const entries: {
      item: TMessageContentComplex;
      source: 'content' | 'reasoning';
      index: number;
    }[] = [];
    const agentRuns: AgentRunInfo[] = [];
    const executionIds = new Set<string>();
    const visit = (current: AgentRunRenderNode) => {
      executionIds.add(current.id);
      if (current !== node) agentRuns.push(current.info);
      for (const entry of current.entries) {
        const item =
          typeof entry.item === 'string'
            ? { type: 'text' as const, text: entry.item }
            : entry.item;
        entries.push({
          ...entry,
          // Selected expert becomes the transcript root. Descendants keep their
          // execution identity so tools/sub-agents/nested experts still group.
          item:
            current === node
              ? { ...item, executionId: run.id, parentExecutionId: undefined }
              : item,
        });
      }
      current.children.forEach(visit);
    };
    visit(node);
    entries.sort((a, b) => a.index - b.index);
    // Presentation cards stay outside process counts, but still belong to their emitting expert.
    const cards = (Array.isArray(message.content) ? message.content : [])
      .map(parseResourceCardContent)
      .filter((card): card is TMessageContentResourceCard => card !== null && !!card.executionId && executionIds.has(card.executionId));
    messages.push({
      id: `${run.id}:${message.id}`,
      type: 'assistant',
      executionId: run.id,
      status: message.status,
      content: [...entries
        .filter((entry) => entry.source === 'content')
        .map((entry) => entry.item), ...cards],
      reasoning: entries
        .filter((entry) => entry.source === 'reasoning')
        .map((entry) => entry.item as TMessageContentReasoning),
      agentRuns,
    });
  }
  return messages;
}
