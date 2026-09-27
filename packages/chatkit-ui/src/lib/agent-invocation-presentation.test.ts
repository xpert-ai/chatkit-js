import { describe, expect, it } from 'vitest';
import {
  buildAssistantRenderTree,
  getAgentRunCounts,
  type AssistantContentEntry,
  type AgentRunRenderNode,
  type AssistantMessageWithAgentRuns,
} from './agent-run-render-tree';
import {
  mergeAgentRunInfo,
  normalizeAgentRunInfo,
  type AgentRunInfo,
} from './agent-runs';

const dispatch = {
  id: 'call-1',
  type: 'component',
  executionId: 'root',
  data: {
    category: 'Tool',
    status: 'success',
    toolset: 'AnyProvider',
    title: 'Review',
  },
};
const child: AgentRunInfo = {
  id: 'child',
  parentId: 'root',
  sourceToolCallId: 'call-1',
  invocationKind: 'external_assistant',
  status: 'success',
  xpertName: 'Reviewer',
};
const reply: AssistantMessageWithAgentRuns = {
  id: 'reply',
  type: 'assistant',
  executionId: 'root',
  content: [dispatch],
  agentRuns: [child],
};

function visibleEntries(message: AssistantMessageWithAgentRuns) {
  const entries: AssistantContentEntry['item'][] = [];
  const visit = (node: AgentRunRenderNode) => {
    entries.push(...node.entries.map(({ item }) => item));
    node.children.forEach(visit);
  };
  for (const unit of buildAssistantRenderTree(message).units) {
    if (unit.type === 'entry') entries.push(unit.entry.item);
    else visit(unit.node);
  }
  return entries;
}

describe('Agent invocation presentation', () => {
  it('preserves the explicit association across live events, history and partial end events', () => {
    const live = normalizeAgentRunInfo({
      id: child.id,
      parentId: child.parentId,
      metadata: {
        invocationKind: child.invocationKind,
        sourceToolCallId: child.sourceToolCallId,
      },
    })!;
    expect(live).toMatchObject({
      parentId: 'root',
      invocationKind: 'external_assistant',
      sourceToolCallId: 'call-1',
    });
    expect(normalizeAgentRunInfo(child)).toMatchObject(live);
    expect(
      mergeAgentRunInfo(live, { id: child.id, status: 'success' }),
    ).toMatchObject(live);
    expect(
      normalizeAgentRunInfo({ id: 'invalid', sourceToolCallId: 123 })
        ?.sourceToolCallId,
    ).toBeUndefined();
  });

  it.each(['external_assistant', 'sub_agent'] as const)(
    'replaces a correlated %s dispatch at its original position without deleting source data',
    (invocationKind) => {
      const before = { type: 'text', text: 'Before', executionId: 'root' };
      const after = { type: 'text', text: 'After', executionId: 'root' };
      const message = {
        ...reply,
        content: [before, dispatch, after],
        agentRuns: [{ ...child, invocationKind }],
      };
      const tree = buildAssistantRenderTree(message);
      expect(tree.units.map((unit) => unit.type)).toEqual([
        'entry',
        'agent',
        'entry',
      ]);
      expect(visibleEntries(message)).toEqual([before, after]);
      expect(message.content).toEqual([before, dispatch, after]);
    },
  );

  it('keeps fallback tools until their child arrives and supports child-first delivery', () => {
    expect(visibleEntries({ ...reply, agentRuns: [] })).toEqual([dispatch]);
    expect(visibleEntries(reply)).toEqual([]);
    expect(
      buildAssistantRenderTree({ ...reply, content: [] }).hasAgentRuns,
    ).toBe(true);
    expect(visibleEntries({ ...reply, content: [dispatch] })).toEqual([]);
  });

  it.each([
    { ...child, sourceToolCallId: undefined },
    { ...child, sourceToolCallId: 'different-call' },
    { ...child, parentId: 'different-parent' },
    { ...child, parentId: undefined },
    { ...child, invocationKind: undefined },
    { ...child, nodeType: 'middleware' },
    { ...child, id: 'root', parentId: undefined, isRoot: true },
  ])('keeps unmatched or unrendered dispatches: %j', (run) => {
    expect(visibleEntries({ ...reply, agentRuns: [run] })).toEqual([dispatch]);
  });

  it('does not guess from the old middleware name and retains unclassified legacy data', () => {
    const legacy = {
      ...dispatch,
      data: { ...dispatch.data, toolset: '__collaborators_middleware__' },
    };
    expect(
      visibleEntries({
        ...reply,
        content: [legacy],
        agentRuns: [{ ...child, sourceToolCallId: undefined }],
      }),
    ).toEqual([legacy]);
    const renamed = {
      ...dispatch,
      data: {
        ...dispatch.data,
        toolset: 'RenamedProvider',
        title: 'Localized title',
      },
    };
    expect(visibleEntries({ ...reply, content: [renamed] })).toEqual([]);
  });

  it.each(['fail', 'failed', 'error', 'timeout', 'interrupted', undefined])(
    'retains dispatch status %s even when a child execution exists',
    (status) => {
      const failed = { ...dispatch, data: { ...dispatch.data, status } };
      expect(visibleEntries({ ...reply, content: [failed] })).toEqual([failed]);
    },
  );

  it('retains explicit errors and non-tool components regardless of an id collision', () => {
    const failed = {
      ...dispatch,
      data: { ...dispatch.data, error: 'Dispatch failed' },
    };
    const dashboard = {
      ...dispatch,
      data: { ...dispatch.data, category: 'Dashboard' },
    };
    expect(visibleEntries({ ...reply, content: [failed, dashboard] })).toEqual([
      failed,
      dashboard,
    ]);
  });

  it('keeps same-name tools and correlates parallel calls by id rather than arrival order', () => {
    const second = { ...dispatch, id: 'call-2' };
    const unrelated = { ...dispatch, id: 'ordinary' };
    const message = {
      ...reply,
      content: [dispatch, second, unrelated],
      agentRuns: [
        { ...child, id: 'second', sourceToolCallId: 'call-2' },
        child,
      ],
    };
    expect(visibleEntries(message)).toEqual([unrelated]);
    expect(
      buildAssistantRenderTree(message)
        .units.filter((unit) => unit.type === 'agent')
        .map((unit) => unit.node.id),
    ).toEqual(['child', 'second']);
  });

  it('scopes tool ids to each parent and excludes only merged entries from nested tool counts', () => {
    const nestedDispatch = {
      ...dispatch,
      executionId: child.id,
      parentExecutionId: 'root',
    };
    const childTool = { ...nestedDispatch, id: 'ordinary' };
    const nested: AgentRunInfo = {
      ...child,
      id: 'nested',
      parentId: child.id,
      invocationKind: 'sub_agent',
    };
    const message = {
      ...reply,
      content: [dispatch, nestedDispatch, childTool],
      agentRuns: [child],
    };
    expect(visibleEntries(message)).toEqual([nestedDispatch, childTool]);
    const correlated = { ...message, agentRuns: [child, nested] };
    expect(visibleEntries(correlated)).toEqual([childTool]);
    const first = buildAssistantRenderTree(correlated).units[0];
    expect(first.type).toBe('agent');
    if (first.type === 'agent')
      expect(getAgentRunCounts(first.node)).toMatchObject({
        tools: 1,
        children: 1,
      });
  });

  it('uses the same association for saved branch history without an execution FK', () => {
    expect(
      visibleEntries({ ...reply, historical: true, executionId: undefined }),
    ).toEqual([]);
  });
});
