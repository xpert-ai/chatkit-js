import { render, screen } from '@testing-library/react';
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

describe('PendingTodos', () => {
  it('renders the todo summary and item list', () => {
    render(
      <PendingTodos
        snapshot={{
          items: [
            {
              id: 'todo-1',
              content: 'Plan the stream wiring',
              status: 'completed',
            },
            {
              id: 'todo-2',
              content: 'Render the composer card',
              status: 'in_progress',
            },
          ],
          receivedAt: Date.now(),
        }}
      />,
    );

    expect(screen.getByText('2 tasks, 1 completed')).toBeInTheDocument();
    expect(screen.getByText('Plan the stream wiring')).toBeInTheDocument();
    expect(screen.getByText('Render the composer card')).toBeInTheDocument();
  });

  it('hides the card when there are no todos to render', () => {
    const { container } = render(
      <PendingTodos snapshot={{ items: [], receivedAt: Date.now() }} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
