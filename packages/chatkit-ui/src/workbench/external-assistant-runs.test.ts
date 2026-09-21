import { describe, expect, it } from 'vitest';
import { mergeAgentRunInfo, normalizeAgentRunInfo } from '../lib/agent-runs';
import {
  collectExternalAssistantRuns,
  toExternalAssistantMessages,
} from './external-assistant-runs';
import {
  buildAssistantRenderTree,
  type AssistantMessageWithAgentRuns,
} from '../lib/agent-run-render-tree';

describe('external Assistant execution selection', () => {
  it('preserves avatars from live events, history and legacy identity DTOs across partial updates', () => {
    const avatar = { emoji: { id: 'memo', unified: '1f4dd' } };
    const live = normalizeAgentRunInfo({
      id: 'external',
      metadata: { assistantAvatar: avatar },
    })!;
    expect(live.avatar).toMatchObject(avatar);
    expect(normalizeAgentRunInfo({ id: 'external', avatar })?.avatar).toEqual(
      live.avatar,
    );
    expect(
      normalizeAgentRunInfo({ id: 'external', xpert: { avatar } })?.avatar,
    ).toEqual(live.avatar);
    expect(
      mergeAgentRunInfo(live, { id: 'external', status: 'success' }).avatar,
    ).toEqual(live.avatar);
    expect(
      normalizeAgentRunInfo({
        id: 'external',
        avatar: { url: '/reviewer.png' },
      })?.avatar?.url,
    ).toBe('/reviewer.png');
    expect(normalizeAgentRunInfo({ id: 'external' })?.avatar).toBeUndefined();
  });
  it('reads an explicit invocation type in live and historical summaries without guessing', () => {
    const live = normalizeAgentRunInfo({
      id: 'external',
      category: 'agent',
      xpertId: 'assistant-2',
      metadata: {
        invocationKind: 'external_assistant',
        assistantName: 'Reviewer',
        model: 'model-a',
      },
    });
    expect(live).toMatchObject({
      invocationKind: 'external_assistant',
      xpertId: 'assistant-2',
      xpertName: 'Reviewer',
      model: 'model-a',
    });
    expect(normalizeAgentRunInfo({ ...live, type: 'agent' })).toMatchObject({
      invocationKind: 'external_assistant',
      model: 'model-a',
    });
    expect(
      normalizeAgentRunInfo({
        id: 'legacy',
        category: 'xpert',
        agentKey: 'external_assistant',
        title: 'External assistant',
      })?.invocationKind,
    ).toBeUndefined();
  });

  it('keeps repeated and nested external calls distinct and preserves sub-agent groups', () => {
    const message: AssistantMessageWithAgentRuns = {
      id: 'message',
      type: 'assistant',
      executionId: 'root',
      content: [
        { type: 'text', text: 'External output', executionId: 'external-1' },
        {
          type: 'text',
          text: 'Sub output',
          executionId: 'sub-1',
          parentExecutionId: 'external-1',
        },
        { type: 'text', text: 'Second call', executionId: 'external-2' },
      ],
      agentRuns: [
        {
          id: 'external-1',
          parentId: 'root',
          invocationKind: 'external_assistant',
          agentKey: 'same-agent',
        },
        { id: 'sub-1', parentId: 'external-1', invocationKind: 'sub_agent' },
        {
          id: 'external-2',
          parentId: 'sub-1',
          invocationKind: 'external_assistant',
          agentKey: 'same-agent',
        },
        { id: 'legacy', parentId: 'root', category: 'xpert' },
      ],
    };
    const runs = collectExternalAssistantRuns([message]);
    expect(runs.map((run) => run.id)).toEqual(['external-1', 'external-2']);
    expect(runs[0].segments[0].node.children[0].id).toBe('sub-1');
    expect(runs[1].segments[0].node.entries[0].item).toMatchObject({
      text: 'Second call',
    });
    const next = collectExternalAssistantRuns([
      {
        ...message,
        agentRuns: message.agentRuns?.map((run) => ({
          ...run,
          status: 'success',
        })),
      },
    ]);
    expect(next[0].info.status).toBe('success');
  });

  it('projects only the selected execution while retaining tools, reasoning and child groups', () => {
    const message: AssistantMessageWithAgentRuns = {
      id: 'parent-message',
      type: 'assistant',
      executionId: 'root',
      status: 'success',
      content: [
        { type: 'text', text: 'Main answer' },
        {
          type: 'text',
          text: '**Expert answer**',
          executionId: 'external',
          parentExecutionId: 'root',
        },
        {
          type: 'component',
          id: 'tool',
          executionId: 'external',
          parentExecutionId: 'root',
          data: {
            type: 'tool',
            status: 'success',
            tool: 'read_file',
            output: 'contents',
          },
        },
        {
          type: 'text',
          text: 'Child answer',
          executionId: 'child',
          parentExecutionId: 'external',
        },
        {
          type: 'text',
          text: 'Nested answer',
          executionId: 'nested',
          parentExecutionId: 'child',
        },
        {
          type: 'text',
          text: 'Other execution',
          executionId: 'other',
          parentExecutionId: 'root',
        },
      ],
      reasoning: [
        { type: 'reasoning', text: 'Main thought' },
        {
          type: 'reasoning',
          text: 'Expert thought',
          executionId: 'external',
          parentExecutionId: 'root',
        },
      ],
      agentRuns: [
        {
          id: 'external',
          parentId: 'root',
          invocationKind: 'external_assistant',
          inputs: { input: 'Review this' },
        },
        { id: 'child', parentId: 'external', invocationKind: 'sub_agent' },
        {
          id: 'nested',
          parentId: 'child',
          invocationKind: 'external_assistant',
        },
        { id: 'other', parentId: 'root', invocationKind: 'external_assistant' },
      ],
    };
    const original = structuredClone(message);
    const [selected] = collectExternalAssistantRuns([message]);
    const transcript = toExternalAssistantMessages(selected);
    expect(transcript[0]).toMatchObject({
      type: 'user',
      content: 'Review this',
    });
    expect(transcript).toHaveLength(2);
    const tree = buildAssistantRenderTree(transcript[1]);
    expect(tree.rootReasoning).toEqual([
      expect.objectContaining({ text: 'Expert thought' }),
    ]);
    expect(
      tree.units
        .filter((unit) => unit.type === 'entry')
        .map((unit) => unit.entry.item),
    ).toEqual([
      expect.objectContaining({ text: 'Expert thought' }),
      expect.objectContaining({ text: '**Expert answer**' }),
      expect.objectContaining({
        id: 'tool',
        data: expect.objectContaining({
          tool: 'read_file',
          output: 'contents',
        }),
      }),
    ]);
    const child = tree.units.find((unit) => unit.type === 'agent');
    expect(child).toMatchObject({
      node: { id: 'child', children: [{ id: 'nested' }] },
    });
    expect(JSON.stringify(transcript)).not.toMatch(
      /Main answer|Main thought|Other execution/,
    );
    expect(message).toEqual(original);
  });

  it('preserves one input and ordered message segments during streaming', () => {
    const first: AssistantMessageWithAgentRuns = {
      id: 'first',
      type: 'assistant',
      executionId: 'root',
      status: 'answering',
      content: [{ type: 'text', text: 'First round', executionId: 'external' }],
      agentRuns: [
        {
          id: 'external',
          parentId: 'root',
          invocationKind: 'external_assistant',
          inputs: { input: 'Review', documentId: 'doc' },
          status: 'running',
        },
      ],
    };
    const next = {
      ...first,
      id: 'next',
      content: [{ type: 'text', text: 'Next round', executionId: 'external' }],
    };
    const [run] = collectExternalAssistantRuns([first, next]);
    const transcript = toExternalAssistantMessages(run);
    expect(transcript).toHaveLength(3);
    expect(JSON.parse(transcript[0].content as string)).toEqual({
      input: 'Review',
      documentId: 'doc',
    });
    expect(transcript.slice(1).map((message) => message.content)).toEqual([
      [expect.objectContaining({ text: 'First round' })],
      [expect.objectContaining({ text: 'Next round' })],
    ]);
    expect(new Set(transcript.map((message) => message.id)).size).toBe(3);
  });
});
