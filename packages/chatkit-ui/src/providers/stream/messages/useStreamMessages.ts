import type { ThreadGoal } from '@xpert-ai/chatkit-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ThreadContextUsageByAgentKey } from '../../../lib/thread-context-usage';
import type { TodoListSnapshot } from '../../../lib/todos';
import { createEmptyHistoryMessagePagination } from '../history/pagination';
import type { HistoryMessagePaginationState, StateType } from '../types';

export function useStreamMessages() {
  const [values, setValues] = useState<StateType>({ messages: [] });
  const [historyMessageLoadVersion, setHistoryMessageLoadVersion] = useState(0);
  const [historyMessagePagination, setHistoryMessagePagination] =
    useState<HistoryMessagePaginationState>(() =>
      createEmptyHistoryMessagePagination(),
    );

  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [todos, setTodos] = useState<TodoListSnapshot | null>(null);
  const [contextUsageByAgentKey, setContextUsageByAgentKey] =
    useState<ThreadContextUsageByAgentKey>({});

  const [threadGoal, setThreadGoal] = useState<ThreadGoal | null>(null);
  const valuesRef = useRef<StateType>(values);
  const todosRef = useRef<TodoListSnapshot | null>(null);
  const historyMessagePaginationRef = useRef<HistoryMessagePaginationState>(
    createEmptyHistoryMessagePagination(),
  );

  const updateHistoryMessagePagination = useCallback(
    (
      next:
        | HistoryMessagePaginationState
        | ((
            previous: HistoryMessagePaginationState,
          ) => HistoryMessagePaginationState),
    ) => {
      setHistoryMessagePagination((previous) => {
        const resolved = typeof next === 'function' ? next(previous) : next;
        historyMessagePaginationRef.current = resolved;
        return resolved;
      });
    },
    [],
  );

  const updateTodos = useCallback((nextTodos: TodoListSnapshot | null) => {
    todosRef.current = nextTodos;
    setTodos(nextTodos);
  }, []);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);
  return {
    valuesRef,
    values,
    historyMessageLoadVersion,
    setContextUsageByAgentKey,
    setValues,
    updateTodos,
    updateHistoryMessagePagination,
    setHistoryMessageLoadVersion,
    historyMessagePaginationRef,
    setThreadGoal,
    todosRef,
    threadGoal,
    contextUsageByAgentKey,
    historyMessagePagination,
    todos,
    selectedModelId,
    setSelectedModelId,
  };
}
