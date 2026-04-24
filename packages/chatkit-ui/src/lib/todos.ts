export type TodoItemStatus = 'pending' | 'in_progress' | 'completed';

export type WriteTodosParam = {
  content: string;
  status: TodoItemStatus;
};

export type WriteTodosParams = {
  todos: WriteTodosParam[];
};

export type TodoItem = WriteTodosParam & {
  id: string;
};

export type TodoListSnapshot = {
  items: TodoItem[];
  receivedAt: number;
};

export type TodoToolMessageStatus = 'running' | 'success' | 'fail';

export type WriteTodosMessageComponentData = {
  input: WriteTodosParams;
  category: 'Tool';
  toolset: string;
  tool: 'write_todos';
  title: string;
  created_date: string;
  status: TodoToolMessageStatus;
};

export type WriteTodosMessageComponent = {
  id: string;
  type: 'component';
  agentKey?: string;
  data: WriteTodosMessageComponentData;
};

type WriteTodosParamRecord = {
  content?: unknown;
  status?: unknown;
};

type WriteTodosParamsRecord = {
  todos?: unknown;
};

type WriteTodosMessageComponentDataRecord = {
  input?: unknown;
  category?: unknown;
  toolset?: unknown;
  tool?: unknown;
  title?: unknown;
  created_date?: unknown;
  status?: unknown;
};

type WriteTodosMessageComponentRecord = {
  id?: unknown;
  type?: unknown;
  agentKey?: unknown;
  data?: unknown;
};

function isTodoItemStatus(value: unknown): value is TodoItemStatus {
  return (
    value === 'pending' ||
    value === 'in_progress' ||
    value === 'completed'
  );
}

function isTodoToolMessageStatus(value: unknown): value is TodoToolMessageStatus {
  return value === 'running' || value === 'success' || value === 'fail';
}

function isWriteTodosParam(value: unknown): value is WriteTodosParam {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as WriteTodosParamRecord;
  return (
    typeof record.content === 'string' && isTodoItemStatus(record.status)
  );
}

export function isWriteTodosParams(value: unknown): value is WriteTodosParams {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as WriteTodosParamsRecord;
  return Array.isArray(record.todos) && record.todos.every(isWriteTodosParam);
}

export function isWriteTodosMessageComponentData(
  value: unknown,
): value is WriteTodosMessageComponentData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as WriteTodosMessageComponentDataRecord;
  return (
    isWriteTodosParams(record.input) &&
    record.category === 'Tool' &&
    typeof record.toolset === 'string' &&
    record.tool === 'write_todos' &&
    typeof record.title === 'string' &&
    typeof record.created_date === 'string' &&
    isTodoToolMessageStatus(record.status)
  );
}

export function isWriteTodosMessageComponent(
  value: unknown,
): value is WriteTodosMessageComponent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as WriteTodosMessageComponentRecord;
  return (
    typeof record.id === 'string' &&
    record.type === 'component' &&
    isWriteTodosMessageComponentData(record.data)
  );
}

export function createTodoListSnapshot(
  params: WriteTodosParams,
): TodoListSnapshot {
  return {
    items: params.todos.map((todo, index) => ({
      id: `todo-${index + 1}`,
      content: todo.content,
      status: todo.status,
    })),
    receivedAt: Date.now(),
  };
}

export function extractTodoListFromMessageComponent(
  value: unknown,
): TodoListSnapshot | null {
  if (!isWriteTodosMessageComponent(value)) {
    return null;
  }

  return createTodoListSnapshot(value.data.input);
}

export function countCompletedTodos(items: TodoItem[]): number {
  return items.filter((item) => item.status === 'completed').length;
}
