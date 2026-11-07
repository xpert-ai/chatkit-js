import * as React from 'react';
import { CheckCircle2, Circle, CircleDashed, ListTodo } from 'lucide-react';

import {
  countCompletedTodos,
  type TodoItemStatus,
  type TodoListSnapshot,
} from '../../lib/todos';
import { cn } from '../../lib/utils';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { PendingActivityPanel } from './pending-activity-panel';

export type PendingTodosProps = {
  snapshot: TodoListSnapshot | null;
  attachToComposer?: boolean;
  className?: string;
};

function TodoStatusIcon({ status }: { status: TodoItemStatus }) {
  if (status === 'completed') {
    return (
      <CheckCircle2
        className="shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    );
  }

  if (status === 'in_progress') {
    return (
      <CircleDashed className="shrink-0 text-primary" aria-hidden="true" />
    );
  }

  return (
    <Circle className="shrink-0 text-muted-foreground" aria-hidden="true" />
  );
}

export function PendingTodos({
  snapshot,
  attachToComposer = true,
  className,
}: PendingTodosProps) {
  const { t } = useChatkitTranslation();
  const listId = React.useId();
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  React.useEffect(() => {
    setIsCollapsed(false);
  }, [snapshot?.componentId]);

  if (!snapshot || snapshot.items.length === 0) {
    return null;
  }

  const completedCount = countCompletedTodos(snapshot.items);

  return (
    <PendingActivityPanel
      icon={
        <ListTodo
          className="shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      }
      summary={t('chat.todos.summary', {
        total: snapshot.items.length,
        completed: completedCount,
      })}
      listId={listId}
      isCollapsed={isCollapsed}
      onToggle={() => setIsCollapsed((prev) => !prev)}
      attachToComposer={attachToComposer}
      className={className}
    >
      <ol id={listId} data-slot="pending-activity-list">
        {snapshot.items.map((item, index) => (
          <li
            key={item.id}
            className="grid min-w-0 grid-cols-[auto_1.25rem_minmax(0,1fr)] items-center gap-[calc(0.5rem*var(--chat-density-scale,1))] overflow-hidden"
          >
            <TodoStatusIcon status={item.status} />
            <span
              className={cn(
                'text-sm leading-6 text-foreground',
                item.status === 'completed' ? 'text-muted-foreground' : null,
              )}
            >
              {index + 1}.
            </span>
            <span
              title={item.content}
              className={cn(
                'block min-w-0 truncate text-sm leading-6 text-foreground',
                item.status === 'completed'
                  ? 'text-muted-foreground line-through'
                  : item.status === 'in_progress'
                    ? 'font-medium'
                    : null,
              )}
            >
              {item.content}
            </span>
          </li>
        ))}
      </ol>
    </PendingActivityPanel>
  );
}
