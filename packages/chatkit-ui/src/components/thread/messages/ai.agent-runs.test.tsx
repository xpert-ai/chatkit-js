import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  normalizeAgentRunInfo,
  type AgentRunInfo,
} from '../../../lib/agent-runs';
import { THREAD_CONTEXT_USAGE_EVENT_TYPE } from '../../../lib/thread-context-usage';
import {
  chatkitLanguage,
  createToolComponent,
  renderAssistant,
} from './ai.test-fixture';

describe('AssistantMessage tool components', () => {
  it('updates the running agent run duration over time', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-04-24T12:24:54.398Z'));

    renderAssistant([], {
      executionId: 'root-exec',
      agentRuns: [
        {
          id: 'exec-a',
          parentId: 'root-exec',
          title: 'Researcher',
          status: 'running',
          createdAt: '2026-04-24T12:24:52.898Z',
          updatedAt: '2026-04-24T12:24:52.898Z',
        },
      ],
    });

    expect(
      screen.getByRole('button', { name: /Researcher/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('1.5s')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByText('2.5s')).toBeInTheDocument();
  });

  it('does not start an agent run duration timer without a start timestamp', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const setIntervalSpy = vi.spyOn(window, 'setInterval');

    renderAssistant([], {
      executionId: 'root-exec',
      agentRuns: [
        {
          id: 'exec-a',
          parentId: 'root-exec',
          title: 'Researcher',
          status: 'running',
        },
      ],
    });

    expect(
      screen.getByRole('button', { name: /Researcher/ }),
    ).toBeInTheDocument();
    expect(setIntervalSpy).not.toHaveBeenCalled();

    setIntervalSpy.mockRestore();
  });

  it('renders a branched main assistant reply without an agent card', () => {
    renderAssistant(
      [
        {
          type: 'text',
          text: 'Copied main assistant answer',
          executionId: 'source-root',
          agentKey: 'main-agent',
        },
      ],
      { historical: true, status: 'success', agentRuns: [] },
    );
    expect(screen.getByText('Copied main assistant answer')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /main-agent/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
  });

  it('groups interleaved sub-agent output by execution id', () => {
    renderAssistant(
      [
        {
          id: 'a-text',
          type: 'text',
          text: 'A found the source.',
          executionId: 'exec-a',
          parentExecutionId: 'root-exec',
          agentKey: 'Agent_A',
          xpertName: 'demo-files',
        },
        {
          id: 'b-text',
          type: 'text',
          text: 'B wrote the summary.',
          executionId: 'exec-b',
          parentExecutionId: 'root-exec',
          agentKey: 'Agent_B',
          xpertName: 'demo-files',
        },
        {
          ...createToolComponent('read_a', {
            type: 'files',
            title: 'Read A file',
          }),
          executionId: 'exec-a',
          parentExecutionId: 'root-exec',
          agentKey: 'Agent_A',
          xpertName: 'demo-files',
        },
        {
          id: 'a-text-2',
          type: 'text',
          text: 'A finished.',
          executionId: 'exec-a',
          parentExecutionId: 'root-exec',
          agentKey: 'Agent_A',
          xpertName: 'demo-files',
        },
      ],
      {
        executionId: 'root-exec',
        agentRuns: [
          {
            id: 'exec-a',
            parentId: 'root-exec',
            title: 'Researcher',
            status: 'success',
          },
          {
            id: 'exec-b',
            parentId: 'root-exec',
            title: 'Writer',
            status: 'success',
          },
        ],
      },
    );

    const researcherToggle = screen.getByRole('button', {
      name: /Researcher/,
    });
    const writerToggle = screen.getByRole('button', { name: /Writer/ });

    expect(researcherToggle).toHaveAttribute('aria-expanded', 'false');
    expect(writerToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('demo-files')).not.toBeInTheDocument();
    expect(screen.getByText('B wrote the summary.')).toBeInTheDocument();
    expect(screen.queryByText('A found the source.')).not.toBeInTheDocument();

    fireEvent.click(researcherToggle);

    expect(screen.getByText('A found the source.')).toBeInTheDocument();
    expect(screen.getByText('A finished.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Tool calls.*1 call/ }),
    ).toBeInTheDocument();
  });

  it('uses density-aware spacing for sub-agent render trees', () => {
    renderAssistant(
      [
        {
          id: 'a-text',
          type: 'text',
          text: 'A found the source.',
          executionId: 'exec-a',
          parentExecutionId: 'root-exec',
          agentKey: 'Agent_A',
        },
      ],
      {
        executionId: 'root-exec',
        agentRuns: [
          {
            id: 'exec-a',
            parentId: 'root-exec',
            agentKey: 'Agent_A',
            status: 'success',
          },
        ],
      },
    );

    expect(
      screen.getByRole('button', { name: /Agent_A/ }).closest('.space-y-3'),
    ).toHaveClass(
      'in-data-[density=compact]:space-y-2',
      'in-data-[density=spacious]:space-y-4',
    );
  });

  it('does not render middleware executions as sub-agent groups', () => {
    renderAssistant([{ id: 'answer', type: 'text', text: 'Root answer.' }], {
      executionId: 'root-exec',
      agentRuns: [
        {
          id: 'middleware-run',
          parentId: 'root-exec',
          nodeType: 'middleware',
          agentKey: 'model-retry-node',
          title: 'Model Retry Middleware',
          status: 'success',
        },
      ],
    });

    expect(screen.getByText('Root answer.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Model Retry Middleware/ }),
    ).not.toBeInTheDocument();
  });

  it('renders middleware chat events as compact status rows', () => {
    renderAssistant([
      {
        id: 'middleware:root-exec:model-fallback-node:fallback:1',
        type: 'agent_event',
        event: 'middleware_event',
        title: 'Model fallback',
        message: 'Fallback model succeeded 1/1',
        status: 'success',
        executionId: 'root-exec',
        data: {
          type: 'middleware_event',
          middlewareName: 'ModelFallbackMiddleware',
          middlewareKey: 'model-fallback-node',
          phase: 'fallback_succeeded',
          data: {
            attempt: 1,
            totalAttempts: 1,
          },
        },
      },
      { id: 'answer', type: 'text', text: 'Root answer.' },
    ]);

    const row = screen.getByTestId('middleware-event-row');
    expect(row).toHaveTextContent('Model fallback');
    expect(row).toHaveTextContent('Fallback model succeeded 1/1');
    expect(row).toHaveClass('rounded-full');
    expect(row).not.toHaveClass('rounded-md');
    expect(screen.getByText('Root answer.')).toBeInTheDocument();
  });

  it('localizes middleware chat event text from structured event data', () => {
    chatkitLanguage.value = 'zh-CN';

    renderAssistant([
      {
        id: 'middleware:root-exec:model-fallback-node:fallback:1',
        type: 'agent_event',
        event: 'middleware_event',
        title: 'Model fallback',
        message: 'Fallback model succeeded 1/1',
        status: 'success',
        executionId: 'root-exec',
        data: {
          type: 'middleware_event',
          middlewareName: 'ModelFallbackMiddleware',
          middlewareKey: 'model-fallback-node',
          phase: 'fallback_succeeded',
          data: {
            attempt: 1,
            totalAttempts: 1,
          },
        },
      },
      { id: 'answer', type: 'text', text: 'Root answer.' },
    ]);

    const row = screen.getByTestId('middleware-event-row');
    expect(row).toHaveTextContent('模型回退');
    expect(row).toHaveTextContent('备用模型调用成功 1/1');
    expect(row).not.toHaveTextContent('Model fallback');
    expect(row).not.toHaveTextContent('Fallback model succeeded 1/1');
  });

  it('uses agent event titles and xpert names before agent keys in run headers', () => {
    renderAssistant(
      [
        {
          id: 'named-agent-text',
          type: 'text',
          text: 'Named agent output.',
          executionId: 'exec-named',
          parentExecutionId: 'root-exec',
          agentKey: 'Agent_InternalKey',
          xpertName: 'Readable Agent',
        },
      ],
      {
        executionId: 'root-exec',
        agentRuns: [
          {
            id: 'exec-titled',
            parentId: 'root-exec',
            agentKey: 'web_search',
            title: '网络搜索',
            status: 'success',
          },
        ],
      },
    );

    expect(
      screen.getByRole('button', { name: /Readable Agent/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /网络搜索/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Agent_InternalKey')).not.toBeInTheDocument();
    expect(screen.queryByText('web_search')).not.toBeInTheDocument();
  });

  it('ignores top-level event names when resolving agent run titles', () => {
    const runWithToolName: AgentRunInfo & { name: string } = {
      id: 'exec-name',
      parentId: 'root-exec',
      agentKey: 'Agent_NameTrap',
      name: 'web_search',
      status: 'success',
    };

    renderAssistant([], {
      executionId: 'root-exec',
      agentRuns: [runWithToolName],
    });

    expect(
      screen.getByRole('button', { name: /Agent_NameTrap/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText('web_search')).not.toBeInTheDocument();
  });

  it('normalizes nested agent titles before xpert names', () => {
    expect(
      normalizeAgentRunInfo({
        id: 'exec-agent-title',
        agentKey: 'web_search',
        xpert: { name: 'Team Name' },
        agent: {
          name: 'web_search',
          title: '网络搜索',
        },
      })?.xpertName,
    ).toBe('网络搜索');
  });

  it('keeps simultaneous runs with the same agent key separate', () => {
    renderAssistant(
      [
        {
          id: 'worker-1-text',
          type: 'text',
          text: 'First worker output.',
          executionId: 'worker-run-1',
          parentExecutionId: 'root-exec',
          agentKey: 'Agent_Worker',
        },
        {
          id: 'worker-2-text',
          type: 'text',
          text: 'Second worker output.',
          executionId: 'worker-run-2',
          parentExecutionId: 'root-exec',
          agentKey: 'Agent_Worker',
        },
      ],
      {
        executionId: 'root-exec',
        agentRuns: [
          {
            id: 'worker-run-1',
            parentId: 'root-exec',
            agentKey: 'Agent_Worker',
            title: 'Worker pass 1',
            status: 'success',
          },
          {
            id: 'worker-run-2',
            parentId: 'root-exec',
            agentKey: 'Agent_Worker',
            title: 'Worker pass 2',
            status: 'success',
          },
        ],
      },
    );

    const firstToggle = screen.getByRole('button', { name: /Worker pass 1/ });
    const secondToggle = screen.getByRole('button', { name: /Worker pass 2/ });

    expect(firstToggle).toHaveAttribute('aria-expanded', 'false');
    expect(secondToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Second worker output.')).toBeInTheDocument();
    expect(screen.queryByText('First worker output.')).not.toBeInTheDocument();

    fireEvent.click(firstToggle);

    expect(screen.getByText('First worker output.')).toBeInTheDocument();
  });

  it('renders nested sub-agent runs recursively', () => {
    renderAssistant(
      [
        {
          id: 'parent-text',
          type: 'text',
          text: 'Parent planned the work.',
          executionId: 'parent-run',
          parentExecutionId: 'root-exec',
        },
        {
          id: 'child-text',
          type: 'text',
          text: 'Child completed the task.',
          executionId: 'child-run',
          parentExecutionId: 'parent-run',
        },
      ],
      {
        executionId: 'root-exec',
        agentRuns: [
          {
            id: 'parent-run',
            parentId: 'root-exec',
            title: 'Planner',
            status: 'success',
          },
          {
            id: 'child-run',
            parentId: 'parent-run',
            title: 'Executor',
            status: 'success',
          },
        ],
      },
    );

    expect(screen.getByRole('button', { name: /Planner/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: /Executor/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('Parent planned the work.')).toBeInTheDocument();
    expect(screen.getByText('Child completed the task.')).toBeInTheDocument();
  });

  it('keeps tool component groups inside a sub-agent group', () => {
    renderAssistant(
      [
        {
          ...createToolComponent('read_file', {
            type: 'files',
            title: 'Read file',
          }),
          executionId: 'tool-agent-run',
          parentExecutionId: 'root-exec',
        },
        {
          ...createToolComponent('run_tests', {
            type: 'program',
            title: 'Run tests',
          }),
          executionId: 'tool-agent-run',
          parentExecutionId: 'root-exec',
        },
      ],
      {
        executionId: 'root-exec',
        agentRuns: [
          {
            id: 'tool-agent-run',
            parentId: 'root-exec',
            title: 'Tool worker',
            status: 'success',
          },
        ],
      },
    );

    expect(screen.getByRole('button', { name: /Tool worker/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(
      screen.getByRole('button', { name: /Tool calls.*2 calls.*Processed/ }),
    ).toBeInTheDocument();
  });

  it('hides nested thread context usage artifacts inside sub-agent output', () => {
    renderAssistant(
      [
        {
          id: 'worker-text',
          type: 'text',
          text: 'Visible worker output.',
          executionId: 'usage-worker-run',
          parentExecutionId: 'root-exec',
        },
        {
          id: 'usage-raw',
          type: THREAD_CONTEXT_USAGE_EVENT_TYPE,
          threadId: 'thread-1',
          agentKey: 'Agent_UsageWorker',
          usage: { totalTokens: 120 },
          executionId: 'usage-worker-run',
          parentExecutionId: 'root-exec',
        },
        {
          id: 'usage-agent-event',
          type: 'agent_event',
          event: THREAD_CONTEXT_USAGE_EVENT_TYPE,
          title: THREAD_CONTEXT_USAGE_EVENT_TYPE,
          executionId: 'usage-worker-run',
          parentExecutionId: 'root-exec',
        },
        {
          ...createToolComponent('usage-component', {
            type: THREAD_CONTEXT_USAGE_EVENT_TYPE,
            title: THREAD_CONTEXT_USAGE_EVENT_TYPE,
          }),
          executionId: 'usage-worker-run',
          parentExecutionId: 'root-exec',
        },
      ],
      {
        executionId: 'root-exec',
        agentRuns: [
          {
            id: 'usage-worker-run',
            parentId: 'root-exec',
            title: 'Usage worker',
            status: 'success',
          },
        ],
      },
    );

    const workerToggle = screen.getByRole('button', { name: /Usage worker/ });
    expect(workerToggle).toHaveAccessibleName(/1 message/);
    expect(workerToggle).not.toHaveAccessibleName(/tool/);
    expect(workerToggle).not.toHaveAccessibleName(/event/);
    expect(screen.getByText('Visible worker output.')).toBeInTheDocument();
    expect(
      screen.queryByText(THREAD_CONTEXT_USAGE_EVENT_TYPE),
    ).not.toBeInTheDocument();
  });

  it('expands running sub-agent groups while keeping older completed groups collapsed', () => {
    renderAssistant(
      [
        {
          id: 'done-text',
          type: 'text',
          text: 'Completed output.',
          executionId: 'done-run',
          parentExecutionId: 'root-exec',
        },
        {
          id: 'running-text',
          type: 'text',
          text: 'Streaming output.',
          executionId: 'running-run',
          parentExecutionId: 'root-exec',
        },
      ],
      {
        executionId: 'root-exec',
        agentRuns: [
          {
            id: 'done-run',
            parentId: 'root-exec',
            title: 'Finished worker',
            status: 'success',
          },
          {
            id: 'running-run',
            parentId: 'root-exec',
            title: 'Active worker',
            status: 'running',
          },
        ],
      },
    );

    expect(
      screen.getByRole('button', { name: /Finished worker/ }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('button', { name: /Active worker/ }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('Completed output.')).not.toBeInTheDocument();
    expect(screen.getByText('Streaming output.')).toBeInTheDocument();
    expect(
      screen.getByText('Streaming output.').closest('.text-sm'),
    ).toBeInTheDocument();
  });

  it('keeps sub-agent input and message counts in header icon tooltips only', () => {
    renderAssistant(
      [
        {
          id: 'input-text',
          type: 'text',
          text: 'Input scoped output.',
          executionId: 'input-run',
          parentExecutionId: 'root-exec',
        },
      ],
      {
        executionId: 'root-exec',
        agentRuns: [
          {
            id: 'input-run',
            parentId: 'root-exec',
            title: 'Input worker',
            status: 'success',
            inputs: { input: 'Write a horse joke' },
          },
        ],
      },
    );

    expect(
      screen.getByRole('button', { name: /Input worker/ }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Input')).toBeInTheDocument();
    expect(screen.getByLabelText('1 message')).toBeInTheDocument();
    expect(screen.queryByText(/Input:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Write a horse joke/)).not.toBeInTheDocument();
  });

  it('labels pending sub-agent groups with output as replied', () => {
    renderAssistant(
      [
        {
          id: 'reply-text',
          type: 'text',
          text: 'Reply is ready.',
          executionId: 'reply-run',
          parentExecutionId: 'root-exec',
        },
      ],
      {
        executionId: 'root-exec',
        agentRuns: [
          {
            id: 'reply-run',
            parentId: 'root-exec',
            title: 'Reply worker',
            status: 'pending',
          },
        ],
      },
    );

    expect(
      screen.getByRole('button', { name: /Reply worker/ }),
    ).toHaveTextContent('Replied');
    expect(screen.queryByText('Pending')).not.toBeInTheDocument();
  });
});
