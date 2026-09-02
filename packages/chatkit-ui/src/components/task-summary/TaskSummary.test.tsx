import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../../i18n';
import type { MergedTaskSummary } from '../../lib/task-summary';
import { TaskSummaryPanel, TaskSummaryTrigger } from './TaskSummary';

afterEach(() => {
  setLanguage('en-US');
});

describe('TaskSummaryTrigger', () => {
  it('renders the six sections in fixed order and emits resource opens', async () => {
    const onOpenResource = vi.fn();
    const onNavigateMessage = vi.fn();
    const onLoadSection = vi.fn();
    render(
      <TaskSummaryTrigger
        summary={summary()}
        onRetryHistory={vi.fn()}
        onLoadSection={onLoadSection}
        onNavigateMessage={onNavigateMessage}
        onFocusComposer={vi.fn()}
        onOpenResource={onOpenResource}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open task summary' }));
    const labels = [
      'Outputs',
      'Sources',
      'Task',
      'Running',
      'Agent activity',
      'Pending',
    ];
    const sections = await Promise.all(
      labels.map((label) => screen.findByRole('region', { name: label })),
    );
    expect(
      sections.map((section) => section.getAttribute('aria-label')),
    ).toEqual(labels);
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('PDF document')).toBeInTheDocument();
    expect(screen.getByText(':4200')).toBeInTheDocument();
    expect(screen.getByText('Connection failed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Report/ }));
    expect(onOpenResource).toHaveBeenCalledWith(
      { type: 'artifact', artifactId: 'artifact-1' },
      'message-1',
      'Report',
    );
    fireEvent.click(screen.getByRole('button', { name: /Specification/ }));
    expect(onNavigateMessage).toHaveBeenCalledWith('message-2');
    expect(onOpenResource).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /View all/ }));
    expect(onLoadSection).toHaveBeenCalledWith('outputs');
  });

  it('uses a popover when the summary is not docked', async () => {
    render(
      <TaskSummaryTrigger
        summary={summary()}
        onRetryHistory={vi.fn()}
        onLoadSection={vi.fn()}
        onNavigateMessage={vi.fn()}
        onFocusComposer={vi.fn()}
        onOpenResource={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open task summary' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('toggles a docked summary without rendering a popover', () => {
    const onOpenChange = vi.fn();
    render(
      <>
        <TaskSummaryTrigger
          displayMode="docked"
          open
          onOpenChange={onOpenChange}
          summary={summary()}
          onRetryHistory={vi.fn()}
          onLoadSection={vi.fn()}
          onNavigateMessage={vi.fn()}
          onFocusComposer={vi.fn()}
          onOpenResource={vi.fn()}
        />
        <TaskSummaryPanel
          summary={summary()}
          onRetryHistory={vi.fn()}
          onLoadSection={vi.fn()}
          onNavigateMessage={vi.fn()}
          onFocusComposer={vi.fn()}
          onOpenResource={vi.fn()}
        />
      </>,
    );

    expect(
      screen.getByRole('complementary', { name: 'Task summary' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('complementary', { name: 'Task summary' }),
    ).toHaveClass('rounded-2xl', 'shadow-lg');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open task summary' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps the empty output prompt without inactive section actions', () => {
    const onFocusComposer = vi.fn();
    const value = summary();
    value.outputs = [];
    value.sources = [];
    value.totals.outputs = 0;
    value.totals.sources = 0;

    render(
      <TaskSummaryPanel
        summary={value}
        onRetryHistory={vi.fn()}
        onLoadSection={vi.fn()}
        onNavigateMessage={vi.fn()}
        onFocusComposer={onFocusComposer}
        onOpenResource={vi.fn()}
      />,
    );

    expect(screen.getByText('Create files or sites')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Create output' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add source' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Create files or sites'));
    expect(onFocusComposer).toHaveBeenCalledOnce();
  });

  it('expands all todos and running services without loading a remote section', () => {
    const value = summary();
    value.todos = {
      componentId: 'todos-1',
      items: Array.from({ length: 4 }, (_, index) => ({
        id: `todo-${index + 1}`,
        content: `Todo ${index + 1}`,
        status: index === 0 ? ('completed' as const) : ('pending' as const),
      })),
    };
    value.running = Array.from({ length: 4 }, (_, index) => ({
      id: `service-${index + 1}`,
      title: `Service ${index + 1}`,
      status: 'running',
    }));
    const onLoadSection = vi.fn();

    render(
      <TaskSummaryPanel
        summary={value}
        onRetryHistory={vi.fn()}
        onLoadSection={onLoadSection}
        onNavigateMessage={vi.fn()}
        onFocusComposer={vi.fn()}
        onOpenResource={vi.fn()}
      />,
    );

    const task = screen.getByRole('region', { name: 'Task' });
    expect(within(task).queryByText('Todo 4')).not.toBeInTheDocument();
    fireEvent.click(within(task).getByRole('button', { name: 'View all' }));
    expect(within(task).getByText('Todo 4')).toBeInTheDocument();

    const running = screen.getByRole('region', { name: 'Running' });
    expect(within(running).queryByText('Service 4')).not.toBeInTheDocument();
    fireEvent.click(within(running).getByRole('button', { name: 'View all' }));
    expect(within(running).getByText('Service 4')).toBeInTheDocument();
    expect(onLoadSection).not.toHaveBeenCalled();
  });

  it.each([
    ['en-US', 'Task', 'paused', 'Paused'],
    ['en-US', 'Task', 'usage_limited', 'Usage limited'],
    ['en-US', 'Task', 'budget_limited', 'Budget limited'],
    ['en-US', 'Task', 'complete', 'Completed'],
    ['zh-CN', '任务', 'paused', '已暂停'],
    ['zh-CN', '任务', 'usage_limited', '用量受限'],
    ['zh-CN', '任务', 'budget_limited', '预算受限'],
    ['zh-CN', '任务', 'complete', '已完成'],
  ] as const)(
    'localizes the %s goal status %s',
    (locale, sectionTitle, status, expected) => {
      setLanguage(locale);
      const value = summary();
      if (value.goal) value.goal.status = status;

      render(
        <TaskSummaryPanel
          summary={value}
          onRetryHistory={vi.fn()}
          onLoadSection={vi.fn()}
          onNavigateMessage={vi.fn()}
          onFocusComposer={vi.fn()}
          onOpenResource={vi.fn()}
        />,
      );

      expect(
        within(
          screen.getByRole('region', { name: sectionTitle }),
        ).getByText(expected),
      ).toBeInTheDocument();
    },
  );
});

function summary(): MergedTaskSummary {
  return {
    goal: {
      id: 'goal-1',
      threadId: 'thread-1',
      objective: 'Ship task summary',
      status: 'active',
      tokensUsed: 0,
      elapsedSeconds: 0,
      continuationCount: 0,
    },
    outputs: [
      {
        id: 'output-1',
        kind: 'document',
        title: 'Report',
        description: 'PDF document',
        status: 'success',
        messageId: 'message-1',
        resource: { type: 'artifact', artifactId: 'artifact-1' },
      },
      {
        id: 'output-2',
        kind: 'document',
        title: 'Inline result',
        resource: { type: 'artifact', artifactId: 'artifact-2' },
      },
    ],
    sources: [
      {
        id: 'source-1',
        kind: 'knowledge',
        title: 'Specification',
        messageId: 'message-2',
        resource: { type: 'message', messageId: 'message-2' },
      },
    ],
    running: [
      {
        id: 'service-1',
        title: 'Preview server',
        status: 'running',
        description: ':4200',
      },
    ],
    agents: [
      {
        id: 'agent-1',
        level: 0,
        title: 'Researcher',
        status: 'error',
        error: 'Connection failed',
      },
    ],
    pending: [
      { id: 'pending-1', kind: 'approval', title: 'Approval required' },
    ],
    totals: { outputs: 4, sources: 1, agents: 1, pending: 1 },
  };
}
