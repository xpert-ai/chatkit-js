import { describe, expect, it } from 'vitest';
import {
  collectLiveTaskSummary,
  mergeTaskSummary,
  type TaskSummaryLiveData,
  type TaskSummarySnapshot,
} from './task-summary';

describe('task summary aggregation', () => {
  it('lets newer live items override the historical baseline by stable id', () => {
    const history = snapshot({
      outputs: {
        total: 2,
        items: [
          {
            id: 'report',
            kind: 'document',
            title: 'Old report',
            updatedAt: '2026-07-13T01:00:00.000Z',
          },
        ],
      },
    });
    const live = emptyLive({
      outputs: [
        {
          id: 'report',
          kind: 'document',
          title: 'Updated report',
          updatedAt: '2026-07-13T02:00:00.000Z',
        },
      ],
    });

    const merged = mergeTaskSummary(history, live);

    expect(merged.outputs).toHaveLength(1);
    expect(merged.outputs[0]?.title).toBe('Updated report');
    expect(merged.totals.outputs).toBe(2);
  });

  it('collects explicit known contributions but ignores arbitrary tool output and paths', () => {
    const live = collectLiveTaskSummary({
      messages: [
        {
          id: 'message-1',
          updatedAt: '2026-07-13T02:00:00.000Z',
          content: [
            { type: 'text', text: 'Created /tmp/result.txt' },
            {
              type: 'component',
              data: { type: 'UnknownTool', output: '/tmp/result.txt' },
            },
            {
              type: 'component',
              data: {
                taskSummary: {
                  version: 1,
                  outputs: [
                    {
                      id: 'report',
                      kind: 'document',
                      title: 'Report',
                      resource: {
                        type: 'artifact',
                        artifactId: 'artifact-1',
                      },
                      raw: 'sensitive tool output',
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    });

    expect(live.outputs.map((item) => item.id)).toEqual(['report']);
    expect(JSON.stringify(live)).not.toContain('/tmp/result.txt');
    expect(JSON.stringify(live)).not.toContain('sensitive tool output');
  });

  it('keeps element and file_element sources available to the summary', () => {
    const live = collectLiveTaskSummary({
      messages: [
        {
          id: 'message-1',
          references: [
            {
              type: 'element',
              text: 'Submit',
              attributes: [],
              outerHtml: '<button>Submit</button>',
              pageUrl: 'https://example.com',
              selector: 'button',
              serviceId: 'service-1',
              tagName: 'button',
            },
            {
              type: 'file_element',
              text: 'Revenue',
              attributes: [],
              domPath: 'table/row',
              filePath: '/workspace/report.xlsx',
              outerHtml: '<tr />',
              selector: 'tr',
              tagName: 'tr',
            },
          ],
        },
      ],
    });

    expect(live.sources.map((item) => item.kind)).toEqual([
      'web_page',
      'file_element',
    ]);
  });

  it('shows only invoked sub-agents by configured name without treating available agents as sources', () => {
    const live = collectLiveTaskSummary({
      messages: [
        {
          id: 'message-1',
          taskSummary: {
            version: 1,
            sources: [
              {
                id: 'sub-agent:Agent_wzkLtrU4Ai',
                kind: 'sub_agent',
                title: 'Agent_wzkLtrU4Ai',
              },
            ],
          },
          runtimeCapabilities: {
            mode: 'allowlist',
            skills: { ids: [] },
            plugins: { nodeKeys: [] },
            subAgents: { nodeKeys: ['Agent_wzkLtrU4Ai'] },
          },
          agentRuns: [
            {
              id: 'root-execution',
              agentKey: 'Agent_primary',
              title: 'Primary Agent',
              status: 'running',
              updatedAt: '2026-07-13T03:00:00.000Z',
            },
            {
              id: 'execution-1',
              parentId: 'root-execution',
              agentKey: 'Agent_wzkLtrU4Ai',
              title: 'Diagnosis Runner',
              status: 'error',
              updatedAt: '2026-07-13T01:00:00.000Z',
            },
            {
              id: 'execution-2',
              parentId: 'root-execution',
              agentKey: 'Agent_wzkLtrU4Ai',
              title: 'Diagnosis Runner',
              status: 'running',
              updatedAt: '2026-07-13T02:00:00.000Z',
            },
          ],
        },
      ],
      agentNames: new Map([['Agent_wzkLtrU4Ai', 'diagnosis_runner']]),
    });

    expect(live.sources).toEqual([]);
    expect(live.agents).toEqual([
      expect.objectContaining({
        id: 'execution-2',
        title: 'diagnosis_runner',
        status: 'running',
      }),
    ]);
  });

  it('merges historical and live executions by agent key', () => {
    const history = snapshot({
      agents: {
        total: 2,
        items: [
          {
            id: 'execution-1',
            level: 0,
            agentKey: 'Agent_Main',
            title: 'main_controller',
            status: 'success',
            updatedAt: '2026-07-13T01:00:00.000Z',
          },
        ],
      },
    });
    const live = emptyLive({
      agents: [
        {
          id: 'execution-2',
          level: 0,
          agentKey: 'Agent_Main',
          title: 'main_controller',
          status: 'running',
          updatedAt: '2026-07-13T02:00:00.000Z',
        },
      ],
    });

    const merged = mergeTaskSummary(history, live);

    expect(merged.agents).toEqual([
      expect.objectContaining({ id: 'execution-2', status: 'running' }),
    ]);
    expect(merged.totals.agents).toBe(1);
  });

  it('excludes primary agent executions from historical summaries', () => {
    const history = snapshot({
      agents: {
        total: 2,
        items: [
          {
            id: 'root-execution',
            level: 0,
            agentKey: 'Agent_primary',
            title: 'Primary Agent',
            status: 'success',
          },
          {
            id: 'child-execution',
            parentId: 'root-execution',
            level: 1,
            agentKey: 'Agent_researcher',
            title: 'Researcher',
            status: 'success',
          },
        ],
      },
    });

    const merged = mergeTaskSummary(history, emptyLive({}));

    expect(merged.agents).toEqual([
      expect.objectContaining({ id: 'child-execution' }),
    ]);
    expect(merged.totals.agents).toBe(1);
  });
});

function snapshot(partial: Partial<TaskSummarySnapshot>): TaskSummarySnapshot {
  return {
    version: 1,
    conversationId: 'conversation-1',
    threadId: 'thread-1',
    task: {},
    outputs: { items: [], total: 0 },
    sources: { items: [], total: 0 },
    agents: { items: [], total: 0 },
    pending: { items: [], total: 0 },
    updatedAt: '2026-07-13T00:00:00.000Z',
    ...partial,
  };
}

function emptyLive(partial: Partial<TaskSummaryLiveData>): TaskSummaryLiveData {
  return {
    outputs: [],
    sources: [],
    agents: [],
    pending: [],
    running: [],
    ...partial,
  };
}
