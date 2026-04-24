import { describe, expect, it, vi } from 'vitest';

import {
  countCompletedTodos,
  createTodoListSnapshot,
  extractTodoListFromMessageComponent,
  isWriteTodosMessageComponent,
  isWriteTodosMessageComponentData,
  isWriteTodosParams,
} from './todos';

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

describe('isWriteTodosMessageComponentData', () => {
  it('accepts the explicit tool component payload', () => {
    expect(
      isWriteTodosMessageComponentData({
        input: {
          todos: [
            {
              content: 'Query ontology structure',
              status: 'in_progress',
            },
          ],
        },
        category: 'Tool',
        toolset: 'todoListMiddleware',
        tool: 'write_todos',
        title: 'write_todos',
        created_date: '2026-04-24T12:24:52.898Z',
        status: 'running',
      }),
    ).toBe(true);
  });

  it('rejects non-tool payloads', () => {
    expect(
      isWriteTodosMessageComponentData({
        input: { todos: [] },
        category: 'Tool',
        toolset: 'todoListMiddleware',
        tool: 'other_tool',
        title: 'other_tool',
        created_date: '2026-04-24T12:24:52.898Z',
        status: 'running',
      }),
    ).toBe(false);
  });
});

describe('createTodoListSnapshot', () => {
  it('maps explicit params to UI todo items', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T08:00:00.000Z'));

    const snapshot = createTodoListSnapshot({
      todos: [
        {
          content: 'Execute the query',
          status: 'pending',
        },
        {
          content: 'Review the result',
          status: 'completed',
        },
      ],
    });

    expect(snapshot).toEqual({
      items: [
        {
          id: 'todo-1',
          content: 'Execute the query',
          status: 'pending',
        },
        {
          id: 'todo-2',
          content: 'Review the result',
          status: 'completed',
        },
      ],
      receivedAt: new Date('2026-04-24T08:00:00.000Z').valueOf(),
    });
    expect(countCompletedTodos(snapshot.items)).toBe(1);

    vi.useRealTimers();
  });
});

describe('extractTodoListFromMessageComponent', () => {
  it('accepts the explicit write_todos message component', () => {
    const component = {
      id: 'tool-03f21fa4e7054e9eb484c560c15fb3f5',
      type: 'component' as const,
      agentKey: 'Agent_xSd1VKEicG',
      data: {
        input: {
          todos: [
            {
              content: 'Render todos card above composer',
              status: 'in_progress' as const,
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

    expect(isWriteTodosMessageComponent(component)).toBe(true);
    expect(extractTodoListFromMessageComponent(component)).toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            id: 'todo-1',
            content: 'Render todos card above composer',
            status: 'in_progress',
          }),
        ],
      }),
    );
  });

  it('rejects unrelated components', () => {
    expect(
      extractTodoListFromMessageComponent({
        id: 'component-1',
        type: 'component',
        data: {
          category: 'Tool',
          tool: 'other_tool',
        },
      }),
    ).toBeNull();
  });
});
