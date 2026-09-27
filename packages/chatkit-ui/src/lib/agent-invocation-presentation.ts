import type {
  AgentRunRenderNode,
  AssistantContentEntry,
} from './agent-run-render-tree';
import { readContentExecutionId } from './agent-runs';

/** Merge dispatch rows only into execution nodes that the tree actually renders. */
export function mergeAgentInvocationEntries(
  roots: AgentRunRenderNode[],
  rootEntries: AssistantContentEntry[],
) {
  const calls = new Map<string, Map<string, AgentRunRenderNode[]>>();
  const nodes: AgentRunRenderNode[] = [];
  const visit = (node: AgentRunRenderNode) => {
    nodes.push(node);
    const { invocationKind, sourceToolCallId, parentId, parentExecutionId } =
      node.info;
    const parent = parentId ?? parentExecutionId;
    if (
      (invocationKind === 'external_assistant' ||
        invocationKind === 'sub_agent') &&
      sourceToolCallId &&
      parent &&
      parent !== node.id
    ) {
      const parentCalls =
        calls.get(parent) ?? new Map<string, AgentRunRenderNode[]>();
      const executions = parentCalls.get(sourceToolCallId) ?? [];
      executions.push(node);
      parentCalls.set(sourceToolCallId, executions);
      calls.set(parent, parentCalls);
    }
    node.children.forEach(visit);
  };
  roots.forEach(visit);

  const keepEntry = (entry: AssistantContentEntry) => {
    const { item } = entry;
    if (typeof item === 'string' || item.type !== 'component' || !item.id)
      return true;
    const parent = readContentExecutionId(item);
    const executions = parent ? calls.get(parent)?.get(item.id) : undefined;
    if (!executions?.length) return true;

    // This is the content boundary: unknown components or dispatch failures stay visible.
    const data: unknown = item.data;
    if (
      !data ||
      typeof data !== 'object' ||
      !('category' in data) ||
      data.category !== 'Tool'
    )
      return true;
    if ('error' in data && data.error) return true;
    if (
      !('status' in data) ||
      (data.status !== 'running' && data.status !== 'success')
    )
      return true;

    // Place the replacement cards where their dispatch appeared, including empty runs.
    executions.forEach((node) => {
      node.firstOrder = Math.min(node.firstOrder, entry.order);
    });
    return false;
  };

  const entries = rootEntries.filter(keepEntry);
  nodes.forEach((node) => {
    node.entries = node.entries.filter(keepEntry);
  });
  return entries;
}
