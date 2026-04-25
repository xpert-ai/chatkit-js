import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string, values?: Record<string, number>) => {
      if (key === 'chat.todos.summary') {
        return `${values?.total} tasks, ${values?.completed} completed`;
      }

      return key;
    },
  }),
}));

vi.mock('../../providers/Theme', () => ({
  useTheme: () => ({
    theme: {
      radius: 'soft',
    },
    isDarkMode: false,
  }),
}));

import { PendingTodos } from './pending-todos';

function createSnapshot() {
  return {
    componentId: 'tool-1',
    title: 'write_todos',
    tool: 'write_todos' as const,
    category: 'Tool' as const,
    toolset: 'todoListMiddleware',
    status: 'running' as const,
    createdDate: '2026-04-24T12:24:52.898Z',
    items: [
      {
        id: 'todo-1',
        content: 'Plan the stream wiring',
        status: 'completed' as const,
      },
      {
        id: 'todo-2',
        content: 'Render the composer card',
        status: 'in_progress' as const,
      },
    ],
    receivedAt: Date.now(),
  };
}

describe('PendingTodos', () => {
  it('renders the todo summary and item list', () => {
    render(<PendingTodos snapshot={createSnapshot()} />);

    expect(screen.getByText('2 tasks, 1 completed')).toBeInTheDocument();
    expect(screen.getByText('Plan the stream wiring')).toBeInTheDocument();
    expect(screen.getByText('Render the composer card')).toHaveClass('truncate');
  });

  it('toggles the todo list when the header is clicked', () => {
    render(<PendingTodos snapshot={createSnapshot()} />);

    const toggle = screen.getByRole('button');

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Plan the stream wiring')).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Plan the stream wiring')).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Plan the stream wiring')).toBeInTheDocument();
  });

  it('hides the card when there are no todos to render', () => {
    const { container } = render(
      <PendingTodos
        snapshot={{
          ...createSnapshot(),
          items: [],
        }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
