import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MergedTaskSummary } from '../../lib/task-summary';
import { TaskSummaryPanel, TaskSummaryTrigger } from './TaskSummary';

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

    fireEvent.click(screen.getByRole('button', { name: /Report/ }));
    expect(onOpenResource).toHaveBeenCalledWith(
      { type: 'artifact', artifactId: 'artifact-1' },
      'message-1',
      'Report',
    );
    fireEvent.click(screen.getByRole('button', { name: /Inline result/ }));
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

  it('keeps Codex-style output and source actions visible when empty', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Create output' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add source' }));
    expect(onFocusComposer).toHaveBeenCalledTimes(2);
  });
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
        messageId: 'message-1',
        resource: { type: 'artifact', artifactId: 'artifact-1' },
      },
      {
        id: 'output-2',
        kind: 'mcp_app',
        title: 'Inline result',
        resource: { type: 'message', messageId: 'message-2' },
      },
    ],
    sources: [{ id: 'source-1', kind: 'knowledge', title: 'Specification' }],
    running: [{ id: 'service-1', title: 'Preview server', status: 'running' }],
    agents: [
      { id: 'agent-1', level: 0, title: 'Researcher', status: 'success' },
    ],
    pending: [
      { id: 'pending-1', kind: 'approval', title: 'Approval required' },
    ],
    totals: { outputs: 4, sources: 1, agents: 1, pending: 1 },
  };
}
