import {
  ChatMessageStepCategory,
  REQUEST_USER_INPUT_TOOL_NAME,
  REQUEST_USER_INPUT_RESULT_TYPE,
} from '@xpert-ai/chatkit-types';
import {
  buildAssistantRenderTree,
  getAgentRunDuration,
  type AssistantMessageWithAgentRuns,
  type AssistantRenderUnit,
} from './agent-run-render-tree';

const processStepTypes = new Set<string>([
  'tool',
  'command',
  'context-compression',
  ChatMessageStepCategory.List,
  ChatMessageStepCategory.WebSearch,
  ChatMessageStepCategory.Files,
  ChatMessageStepCategory.File,
  ChatMessageStepCategory.Program,
  ChatMessageStepCategory.Memory,
  ChatMessageStepCategory.Tasks,
  ChatMessageStepCategory.Knowledges,
]);

const attentionStatuses = new Set([
  'error',
  'fail',
  'failed',
  'aborted',
  'interrupted',
  'paused',
  'pausing',
  'pending',
  'timeout',
]);

export function needsProcessAttention(message: AssistantMessageWithAgentRuns) {
  return attentionStatuses.has(message.status?.toLowerCase() ?? '');
}

function isAnswerUnit(unit: AssistantRenderUnit) {
  if (unit.type !== 'entry') return false;
  const item = unit.entry.item;
  if (typeof item === 'string') return Boolean(item.trim());
  if (item.type === 'text') return Boolean(item.text?.trim());
  if (item.type === 'image_url') return true;
  // Final rich results must stay outside the process disclosure.
  return (
    item.type === 'component' &&
    (item.data?.type === 'Widget' || item.data?.type === 'McpApp')
  );
}

function isFoldableProcessUnit(
  unit: AssistantRenderUnit,
  allowRunning = false,
): boolean {
  if (unit.type === 'agent') {
    return (
      !attentionStatuses.has(unit.node.info.status?.toLowerCase() ?? '') &&
      unit.node.info.error == null &&
      unit.node.entries.every((entry) =>
        isFoldableProcessUnit(
          { type: 'entry', entry, order: entry.order },
          allowRunning,
        ),
      ) &&
      unit.node.children.every((node) =>
        isFoldableProcessUnit(
          { type: 'agent', node, order: node.firstOrder },
          allowRunning,
        ),
      )
    );
  }
  const item = unit.entry.item;
  if (typeof item === 'string') return true;
  if (
    item.type === 'text' ||
    item.type === 'reasoning' ||
    item.type === 'image_url'
  )
    return true;
  if (item.type === 'agent_event') return item.status === 'success';
  if (item.type !== 'component') return false;
  const data = item.data;
  // Unknown and interactive components remain visible, including approvals,
  // questions, widgets and MCP Apps. Only ordinary tool steps can be folded.
  return (
    data?.category === 'Tool' &&
    // Generic tool steps may omit the optional display subtype.
    (data.type == null || processStepTypes.has(data.type)) &&
    (data.status === 'success' ||
      (allowRunning && data.status === 'running')) &&
    !data.error &&
    data.tool !== REQUEST_USER_INPUT_TOOL_NAME &&
    data.type !== REQUEST_USER_INPUT_RESULT_TYPE
  );
}

export function getAssistantPresentation(
  message: AssistantMessageWithAgentRuns,
) {
  const tree = buildAssistantRenderTree(message);
  let boundary = tree.units.length;
  while (boundary > 0 && isAnswerUnit(tree.units[boundary - 1])) boundary -= 1;
  const answer = tree.units.slice(boundary);
  const process = tree.units.slice(0, boundary);
  const hasRootText = answer.some(
    (unit) =>
      unit.type === 'entry' &&
      (typeof unit.entry.item === 'string' || unit.entry.item.type === 'text'),
  );
  const safe =
    hasRootText &&
    process.every((unit) =>
      isFoldableProcessUnit(unit, message.status !== 'success'),
    );
  const root =
    message.agentRuns?.find((run) => run.id === message.executionId) ??
    message.agentRuns?.find((run) => run.isRoot);
  const duration = root ? getAgentRunDuration(root) : null;
  return {
    process: safe ? process : [],
    answer: safe ? answer : tree.units,
    canSeparate: safe,
    // Missing execution timing is not estimated from message timestamps.
    durationMs: duration !== null && duration >= 0 ? duration : undefined,
  };
}

export function getFinalAnswerText(message: AssistantMessageWithAgentRuns) {
  if (message.status !== 'success') return undefined;
  const { answer, canSeparate } = getAssistantPresentation(message);
  if (!canSeparate) return undefined;
  return answer
    .flatMap((unit) => {
      if (unit.type !== 'entry') return [];
      const item = unit.entry.item;
      return typeof item === 'string'
        ? [item]
        : item.type === 'text'
          ? [item.text]
          : [];
    })
    .join('\n\n');
}

/** Group only within a human turn. Missing page prefixes and ambiguous runs stay flat. */
export function groupAssistantProcessMessages(
  messages: AssistantMessageWithAgentRuns[],
) {
  const groups = new Map<number, number[]>();
  let preceding: number[] = [];
  let hasHumanBoundary = false;
  const flush = () => {
    const finalIndex = preceding.at(-1);
    if (!hasHumanBoundary || finalIndex === undefined || preceding.length < 2)
      return;
    const final = messages[finalIndex];
    if (
      !['ai', 'assistant'].includes(String(final.type)) ||
      final.status !== 'success' ||
      !getAssistantPresentation(final).canSeparate
    )
      return;
    const rootIds = new Set([
      final.executionId,
      ...(final.rootExecutionIds ?? []),
    ]);
    const earlier = preceding.slice(0, -1);
    if (
      earlier.some((index) => {
        const message = messages[index];
        return (
          needsProcessAttention(message) ||
          (message.status !== 'success' &&
            (String(message.type) !== 'tool' || message.status != null)) ||
          (message.executionId &&
            final.executionId &&
            !rootIds.has(message.executionId)) ||
          !buildAssistantRenderTree(message).units.every((unit) =>
            isFoldableProcessUnit(unit),
          )
        );
      })
    )
      return;
    groups.set(finalIndex, earlier);
  };
  messages.forEach((message, index) => {
    const type = String(message.type);
    if (type === 'human' || type === 'user') {
      flush();
      preceding = [];
      hasHumanBoundary = true;
    } else if (['ai', 'assistant', 'tool'].includes(type)) {
      preceding.push(index);
    } else {
      flush();
      preceding = [];
      hasHumanBoundary = false;
    }
  });
  flush();
  return groups;
}
