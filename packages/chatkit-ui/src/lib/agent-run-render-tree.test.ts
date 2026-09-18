import { describe, expect, it } from 'vitest';

import {
  buildAssistantRenderTree,
  type AgentRunRenderNode,
  type AssistantMessageWithAgentRuns,
} from './agent-run-render-tree';

function getAgentNodes(
  message: AssistantMessageWithAgentRuns,
): AgentRunRenderNode[] {
  return buildAssistantRenderTree(message)
    .units.filter((item) => item.type === 'agent')
    .map((item) => item.node);
}

describe('buildAssistantRenderTree', () => {
  it('interleaves distinct reasoning rounds with dated content without merging them', () => {
    const first = {
      id: 'r1',
      type: 'reasoning' as const,
      text: 'First',
      created_date: '2026-09-18T01:00:00Z',
    };
    const second = {
      id: 'r2',
      type: 'reasoning' as const,
      text: 'Second',
      created_date: '2026-09-18T01:00:02Z',
    };
    const result = buildAssistantRenderTree({
      id: 'message',
      type: 'assistant',
      reasoning: [first, second],
      content: [
        {
          id: 'tool',
          type: 'component',
          data: {},
          created_date: '2026-09-18T01:00:01Z',
        },
        {
          id: 'answer',
          type: 'text',
          text: 'Done',
          created_date: '2026-09-18T01:00:03Z',
        },
      ],
    });
    expect(
      result.units.map((unit) =>
        unit.type === 'entry' && typeof unit.entry.item !== 'string'
          ? unit.entry.item.id
          : null,
      ),
    ).toEqual(['r1', 'tool', 'r2', 'answer']);
  });

  it('preserves separate legacy reasoning rounds before undated answers', () => {
    const result = buildAssistantRenderTree({
      id: 'message',
      type: 'assistant',
      content: 'Answer',
      reasoning: [
        { id: 'r1', type: 'reasoning', text: 'First' },
        { id: 'r2', type: 'reasoning', text: 'Second' },
      ],
    });
    expect(
      result.units.map((unit) =>
        unit.type === 'entry' ? unit.entry.source : null,
      ),
    ).toEqual(['reasoning', 'reasoning', 'content']);
  });

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
