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
  it('renders copied root text, reasoning and tools without agent cards', () => {
    const result = buildAssistantRenderTree({
      id: 'branched-reply',
      type: 'assistant',
      historical: true,
      status: 'success',
      agentRuns: [],
      reasoning: [
        { type: 'reasoning', text: 'Thinking', executionId: 'source-root' },
      ],
      content: [
        { type: 'text', text: 'Before tool', executionId: 'source-root' },
        { type: 'component', data: {}, executionId: 'source-root' },
        { type: 'text', text: 'After resume', executionId: 'resumed-root' },
      ],
    });
    expect(result.hasAgentRuns).toBe(false);
    expect(result.units.map((unit) => unit.type)).toEqual([
      'entry',
      'entry',
      'entry',
      'entry',
    ]);
    expect(result.rootReasoning).toHaveLength(1);
  });

  it('preserves historical child and external assistant cards with copied root output', () => {
    const result = buildAssistantRenderTree({
      id: 'branched-reply',
      type: 'assistant',
      historical: true,
      status: 'success',
      agentRuns: [
        {
          id: 'child',
          parentId: 'source-root',
          agentKey: 'same-agent',
          invocationKind: 'sub_agent',
        },
        {
          id: 'external',
          parentId: 'source-root',
          invocationKind: 'external_assistant',
        },
      ],
      content: [
        {
          type: 'text',
          text: 'Root answer',
          executionId: 'source-root',
          agentKey: 'same-agent',
        },
        // Saved child metadata supplies the parent even when content omits it.
        {
          type: 'text',
          text: 'Child answer',
          executionId: 'child',
          agentKey: 'same-agent',
        },
        { type: 'text', text: 'External answer', executionId: 'external' },
        {
          type: 'text',
          text: 'Nested answer',
          executionId: 'nested',
          parentExecutionId: 'child',
        },
      ],
    });
    expect(result.units.map((unit) => unit.type)).toEqual([
      'entry',
      'agent',
      'agent',
    ]);
    const nodes = result.units
      .filter((unit) => unit.type === 'agent')
      .map((unit) => unit.node);
    expect(nodes.map((node) => node.id)).toEqual(['child', 'external']);
    expect(nodes[0].children.map((node) => node.id)).toEqual(['nested']);
    expect(nodes[1].info.invocationKind).toBe('external_assistant');
  });

  it('keeps historical child entries grouped when only some content carries the parent', () => {
    const nodes = getAgentNodes({
      id: 'branched-reply',
      type: 'assistant',
      historical: true,
      content: [
        { type: 'text', text: 'Child start', executionId: 'child' },
        {
          type: 'text',
          text: 'Child end',
          executionId: 'child',
          parentExecutionId: 'source-root',
        },
      ],
    });
    expect(nodes).toHaveLength(1);
    expect(nodes[0].entries).toHaveLength(2);
  });

  it('does not flatten live agent output with an unknown root', () => {
    const nodes = getAgentNodes({
      id: 'live-reply',
      type: 'assistant',
      content: [{ type: 'text', text: 'Agent output', executionId: 'agent' }],
    });
    expect(nodes.map((node) => node.id)).toEqual(['agent']);
  });

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

  it('keeps resumed root output flat and preserves real child agents across resumes', () => {
    const result = buildAssistantRenderTree({
      id: 'reply',
      type: 'assistant',
      executionId: 'resumed-root',
      rootExecutionIds: ['original-root', 'middle-root'],
      agentRuns: [
        { id: 'original-root', agentKey: 'same-agent' },
        { id: 'middle-root', agentKey: 'same-agent' },
        { id: 'child', parentId: 'original-root', agentKey: 'same-agent' },
      ],
      content: [
        { type: 'text', text: 'Before pause', executionId: 'original-root' },
        {
          type: 'text',
          text: 'After first resume',
          executionId: 'middle-root',
        },
        {
          type: 'text',
          text: 'Child output',
          executionId: 'child',
          parentExecutionId: 'original-root',
        },
        {
          type: 'text',
          text: 'After second resume',
          executionId: 'resumed-root',
        },
      ],
    });
    expect(result.units.filter((unit) => unit.type === 'entry')).toHaveLength(
      3,
    );
    expect(
      result.units
        .filter((unit) => unit.type === 'agent')
        .map((unit) => unit.node.id),
    ).toEqual(['child']);
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
