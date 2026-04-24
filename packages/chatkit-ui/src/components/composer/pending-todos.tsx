import * as React from 'react';
import { CheckCircle2, Circle, CircleDashed, ListTodo } from 'lucide-react';

import {
  countCompletedTodos,
  type TodoItemStatus,
  type TodoListSnapshot,
} from '../../lib/todos';
import { cn, getRoundedClass } from '../../lib/utils';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { useTheme } from '../../providers/Theme';

export type PendingTodosProps = {
  snapshot: TodoListSnapshot | null;
  attachToComposer?: boolean;
  className?: string;
};

function useRoundedClasses() {
  const { theme } = useTheme();

  return {
    top: theme.radius
      ? {
          pill: 'rounded-t-full',
          round: 'rounded-t-xl',
          soft: 'rounded-t-lg',
          sharp: 'rounded-t-none',
        }[theme.radius]
      : 'rounded-t-lg',
    panel: getRoundedClass(theme.radius, 'rounded-lg'),
  };
}

function TodoStatusIcon({ status }: { status: TodoItemStatus }) {
  if (status === 'completed') {
    return (
      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
    );
  }

  if (status === 'in_progress') {
    return (
      <CircleDashed className="mt-1 h-4 w-4 shrink-0 text-foreground/70" />
    );
  }

  return <Circle className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />;
}

export function PendingTodos({
  snapshot,
  attachToComposer = true,
  className,
}: PendingTodosProps) {
  const { t } = useChatkitTranslation();
  const rounded = useRoundedClasses();

  if (!snapshot || snapshot.items.length === 0) {
    return null;
  }

  const completedCount = countCompletedTodos(snapshot.items);

  return (
    <div
      aria-live="polite"
      className={cn(
        'mx-2 border border-border bg-background/95 px-3 py-3 shadow-sm',
        attachToComposer ? 'border-b-0' : null,
        attachToComposer ? rounded.top : rounded.panel,
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <ListTodo className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span>
          {t('chat.todos.summary', {
            total: snapshot.items.length,
            completed: completedCount,
          })}
        </span>
      </div>

      <ol className="space-y-2.5">
        {snapshot.items.map((item, index) => (
          <li
            key={item.id}
            className="grid grid-cols-[16px_24px_minmax(0,1fr)] items-start gap-2"
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
              className={cn(
                'min-w-0 whitespace-pre-wrap text-sm leading-6 text-foreground',
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
    </div>
  );
}
