import { describe, expect, it } from 'vitest';

import {
  buildAssistantRenderTree,
  type AgentRunRenderNode,
  type AssistantMessageWithAgentRuns,
} from './agent-run-render-tree';

function getAgentNodes(
  message: AssistantMessageWithAgentRuns,
): AgentRunRenderNode[] {
  return buildAssistantRenderTree(message).units
    .filter((item) => item.type === 'agent')
    .map((item) => item.node);
}

describe('buildAssistantRenderTree', () => {
  it('marks incomplete grouped agent nodes successful when the saved message completed', () => {
    const nodes = getAgentNodes({
      id: 'message-1',
      type: 'assistant',
      status: 'success',
      executionId: 'root-execution',
      agentRuns: [
        {
          id: 'pending-execution',
          parentId: 'root-execution',
          status: 'pending',
        },
      ],
      content: [
        {
          id: 'created-from-content',
          type: 'component',
          executionId: 'child-execution',
          parentExecutionId: 'root-execution',
          agentKey: 'child-agent',
          xpertName: 'single file agent',
          data: {
            id: 'created-from-content',
            category: 'Tool',
            title: 'read file',
          },
        },
        {
          id: 'explicit-pending',
          type: 'component',
          executionId: 'pending-execution',
          parentExecutionId: 'root-execution',
          agentKey: 'pending-agent',
          xpertName: 'pending agent',
          data: {
            id: 'explicit-pending',
            category: 'Tool',
            title: 'write file',
          },
        },
      ],
    });

    expect(nodes.map((node) => node.info.status)).toEqual([
      'success',
      'success',
    ]);
  });

  it('does not infer completion while the assistant message is still running', () => {
    const nodes = getAgentNodes({
      id: 'message-1',
      type: 'assistant',
      status: 'running',
      executionId: 'root-execution',
      content: [
        {
          type: 'text',
          text: 'file processing',
          executionId: 'child-execution',
          parentExecutionId: 'root-execution',
          agentKey: 'child-agent',
          xpertName: 'single file agent',
        },
      ],
    });

    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.info.status).toBeUndefined();
  });
});
