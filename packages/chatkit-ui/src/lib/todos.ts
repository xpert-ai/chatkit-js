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

export type TodoToolMessageStatus = 'running' | 'success' | 'fail';

export type TodoListSnapshot = {
  componentId: string;
  title: string;
  tool: 'write_todos';
  category: 'Tool';
  toolset: string;
  status: TodoToolMessageStatus;
  createdDate: string;
  endDate?: string;
  output?: string;
  items: TodoItem[];
  receivedAt: number;
};

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

export type WriteTodosMessageComponentUpdateData = {
  status?: TodoToolMessageStatus;
  end_date?: string;
  output?: string;
};

export type WriteTodosMessageComponentUpdate = {
  id: string;
  type: 'component';
  agentKey?: string;
  data: WriteTodosMessageComponentUpdateData;
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

type WriteTodosMessageComponentUpdateDataRecord = {
  status?: unknown;
  end_date?: unknown;
  output?: unknown;
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

export function isWriteTodosMessageComponentUpdateData(
  value: unknown,
): value is WriteTodosMessageComponentUpdateData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as WriteTodosMessageComponentUpdateDataRecord;
  return (
    (record.status === undefined || isTodoToolMessageStatus(record.status)) &&
    (record.end_date === undefined || typeof record.end_date === 'string') &&
    (record.output === undefined || typeof record.output === 'string') &&
    (record.status !== undefined ||
      record.end_date !== undefined ||
      record.output !== undefined)
  );
}

export function isWriteTodosMessageComponentUpdate(
  value: unknown,
): value is WriteTodosMessageComponentUpdate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as WriteTodosMessageComponentRecord;
  return (
    typeof record.id === 'string' &&
    record.type === 'component' &&
    isWriteTodosMessageComponentUpdateData(record.data)
  );
}

export function createTodoListSnapshot(
  component: WriteTodosMessageComponent,
): TodoListSnapshot {
  return {
    componentId: component.id,
    title: component.data.title,
    tool: component.data.tool,
    category: component.data.category,
    toolset: component.data.toolset,
    status: component.data.status,
    createdDate: component.data.created_date,
    items: component.data.input.todos.map((todo, index) => ({
      id: `todo-${index + 1}`,
      content: todo.content,
      status: todo.status,
    })),
    receivedAt: Date.now(),
  };
}

export function mergeTodoListSnapshot(
  snapshot: TodoListSnapshot,
  update: WriteTodosMessageComponentUpdate,
): TodoListSnapshot {
  return {
    ...snapshot,
    status: update.data.status ?? snapshot.status,
    endDate: update.data.end_date ?? snapshot.endDate,
    output: update.data.output ?? snapshot.output,
    receivedAt: Date.now(),
  };
}

export function resolveTodoListSnapshotFromMessageComponent(
  value: unknown,
  currentSnapshot?: TodoListSnapshot | null,
): {
  matched: boolean;
  snapshot: TodoListSnapshot | null;
} {
  if (isWriteTodosMessageComponent(value)) {
    return {
      matched: true,
      snapshot: createTodoListSnapshot(value),
    };
  }

  if (
    currentSnapshot &&
    isWriteTodosMessageComponentUpdate(value) &&
    value.id === currentSnapshot.componentId
  ) {
    return {
      matched: true,
      snapshot: mergeTodoListSnapshot(currentSnapshot, value),
    };
  }

  return {
    matched: false,
    snapshot: null,
  };
}

export function countCompletedTodos(items: TodoItem[]): number {
  return items.filter((item) => item.status === 'completed').length;
}
