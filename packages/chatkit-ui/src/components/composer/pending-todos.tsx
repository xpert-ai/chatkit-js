import * as React from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDashed,
  ListTodo,
} from 'lucide-react';

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
    <div
      aria-live="polite"
      className={cn(
        'mx-2 border border-border bg-background/95 px-3 py-3 shadow-sm',
        attachToComposer ? 'border-b-0' : null,
        attachToComposer ? rounded.top : rounded.panel,
        className,
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={!isCollapsed}
        aria-controls={listId}
        onClick={() => setIsCollapsed((prev) => !prev)}
      >
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
          <ListTodo className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {t('chat.todos.summary', {
              total: snapshot.items.length,
              completed: completedCount,
            })}
          </span>
        </div>
        <div className="flex items-center shrink-0">
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              isCollapsed ? null : 'rotate-180',
            )}
          />
        </div>
      </button>

      {!isCollapsed && (
        <ol id={listId} className="mt-3 space-y-2.5">
          {snapshot.items.map((item, index) => (
            <li
              key={item.id}
              className="grid min-w-0 grid-cols-[16px_24px_minmax(0,1fr)] items-start gap-2 overflow-hidden"
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
      )}
    </div>
  );
}
