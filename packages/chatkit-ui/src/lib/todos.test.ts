import { describe, expect, it, vi } from 'vitest';

import {
  countCompletedTodos,
  createTodoListSnapshot,
  isWriteTodosMessageComponent,
  isWriteTodosMessageComponentData,
  isWriteTodosMessageComponentUpdate,
  isWriteTodosMessageComponentUpdateData,
  isWriteTodosParams,
  mergeTodoListSnapshot,
  resolveTodoListSnapshotFromMessageComponent,
} from './todos';

function createWriteTodosComponent() {
  return {
    id: 'tool-03f21fa4e7054e9eb484c560c15fb3f5',
    type: 'component' as const,
    agentKey: 'Agent_xSd1VKEicG',
    data: {
      input: {
        todos: [
          {
            content: 'Query ontology structure',
            status: 'in_progress' as const,
          },
          {
            content: 'Build the RDF query',
            status: 'pending' as const,
          },
        ],
      },
      category: 'Tool' as const,
      toolset: 'todoListMiddleware',
      tool: 'write_todos' as const,
      title: 'write_todos',
      created_date: '2026-04-24T12:24:52.898Z',
      status: 'running' as const,
    },
  };
}

describe('isWriteTodosParams', () => {
  it('accepts the explicit write_todos params shape', () => {
    expect(
      isWriteTodosParams({
        todos: [
          {
            content: 'Inspect ontology schema',
            status: 'in_progress',
          },
          {
            content: 'Build the RDF query',
            status: 'pending',
          },
        ],
      }),
    ).toBe(true);
  });

  it('rejects invalid todo entries', () => {
    expect(
      isWriteTodosParams({
        todos: [
          {
            content: 'Missing known status',
            status: 'doing',
          },
        ],
      }),
    ).toBe(false);
  });
});

describe('write_todos message components', () => {
  it('accepts the explicit tool component payload', () => {
    expect(
      isWriteTodosMessageComponentData(createWriteTodosComponent().data),
    ).toBe(true);
    expect(isWriteTodosMessageComponent(createWriteTodosComponent())).toBe(
      true,
    );
  });

  it('accepts partial update payloads keyed by the same component id', () => {
    expect(
      isWriteTodosMessageComponentUpdateData({
        status: 'success',
        end_date: '2026-04-24T12:24:54.398Z',
        output: 'Updated todo list',
      }),
    ).toBe(true);

    expect(
      isWriteTodosMessageComponentUpdate({
        id: 'tool-03f21fa4e7054e9eb484c560c15fb3f5',
        type: 'component',
        data: {
          status: 'success',
          end_date: '2026-04-24T12:24:54.398Z',
          output: 'Updated todo list',
        },
      }),
    ).toBe(true);
  });
});

describe('todo snapshots', () => {
  it('maps the initial component payload to UI snapshot state', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T08:00:00.000Z'));

    const snapshot = createTodoListSnapshot(createWriteTodosComponent());

    expect(snapshot).toEqual({
      componentId: 'tool-03f21fa4e7054e9eb484c560c15fb3f5',
      title: 'write_todos',
      tool: 'write_todos',
      category: 'Tool',
      toolset: 'todoListMiddleware',
      status: 'running',
      createdDate: '2026-04-24T12:24:52.898Z',
      items: [
        {
          id: 'todo-1',
          content: 'Query ontology structure',
          status: 'in_progress',
        },
        {
          id: 'todo-2',
          content: 'Build the RDF query',
          status: 'pending',
        },
      ],
      receivedAt: new Date('2026-04-24T08:00:00.000Z').valueOf(),
    });
    expect(countCompletedTodos(snapshot.items)).toBe(0);

    vi.useRealTimers();
  });

  it('merges later updates without dropping original tool metadata', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T08:00:00.000Z'));

    const snapshot = createTodoListSnapshot(createWriteTodosComponent());

    vi.setSystemTime(new Date('2026-04-24T08:00:01.000Z'));
    const merged = mergeTodoListSnapshot(snapshot, {
      id: 'tool-03f21fa4e7054e9eb484c560c15fb3f5',
      type: 'component',
      data: {
        status: 'success',
        end_date: '2026-04-24T12:24:54.398Z',
        output: 'Updated todo list',
      },
    });

    expect(merged).toEqual({
      ...snapshot,
      status: 'success',
      endDate: '2026-04-24T12:24:54.398Z',
      output: 'Updated todo list',
      receivedAt: new Date('2026-04-24T08:00:01.000Z').valueOf(),
    });

    vi.useRealTimers();
  });

  it('resolves both the initial component and later partial updates', () => {
    const initial = resolveTodoListSnapshotFromMessageComponent(
      createWriteTodosComponent(),
      null,
    );

    expect(initial.matched).toBe(true);
    expect(initial.snapshot).toEqual(
      expect.objectContaining({
        componentId: 'tool-03f21fa4e7054e9eb484c560c15fb3f5',
      }),
    );

    const updated = resolveTodoListSnapshotFromMessageComponent(
      {
        id: 'tool-03f21fa4e7054e9eb484c560c15fb3f5',
        type: 'component',
        data: {
          status: 'success',
          end_date: '2026-04-24T12:24:54.399Z',
        },
      },
      initial.snapshot,
    );

    expect(updated.matched).toBe(true);
    expect(updated.snapshot).toEqual(
      expect.objectContaining({
        status: 'success',
        endDate: '2026-04-24T12:24:54.399Z',
        title: 'write_todos',
        tool: 'write_todos',
      }),
    );
  });
});
