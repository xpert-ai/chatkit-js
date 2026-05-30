import type { ChatKitGoalAdapter, ThreadGoal } from '@xpert-ai/chatkit-types';
import { describe, expect, it, vi } from 'vitest';
import {
  executeThreadGoalCommand,
  parseGoalCommand,
  parseThreadGoal,
  parseThreadGoalUpdatedPatchEvent,
} from './thread-goals';
import {
  createXpertThreadGoalAdapter,
  supportsXpertThreadGoalAdapter,
  type XpertGoalClient,
} from './xpert-thread-goal-adapter';

function sdkThreadFixture(threadId = 'thread-1') {
  return {
    thread_id: threadId,
    created_at: '2026-05-31T00:00:00.000Z',
    updated_at: '2026-05-31T00:00:00.000Z',
    metadata: {},
    status: 'idle' as const,
    values: {},
    interrupts: {},
  };
}

function goalFixture(overrides: Partial<ChatKitGoalAdapter> = {}) {
  const adapter: ChatKitGoalAdapter = {
    getGoal: vi.fn(async () => null),
    setGoal: vi.fn(async ({ threadId, objective }) => ({
      threadId: threadId ?? 'thread-new',
      goal: {
        id: 'goal-1',
        conversationId: 'conversation-1',
        threadId: threadId ?? 'thread-new',
        objective,
        status: 'active' as const,
        tokensUsed: 0,
        elapsedSeconds: 0,
        continuationCount: 0,
      },
    })),
    updateGoal: vi.fn(async ({ threadId, objective, status }) => ({
      id: 'goal-1',
      conversationId: 'conversation-1',
      threadId,
      objective: objective ?? 'ship feature',
      status: (status ?? 'active') as ThreadGoal['status'],
      tokensUsed: 0,
      elapsedSeconds: 0,
      continuationCount: 0,
    })),
    clearGoal: vi.fn(async () => null),
    ...overrides,
  };
  return adapter;
}

function xpertGoalClientFixture(): XpertGoalClient {
  return {
    threads: {
      create: vi.fn(async () => sdkThreadFixture('thread-1')),
    },
    conversations: {
      search: vi.fn(async () => ({
        items: [
          {
            id: 'conversation-1',
            threadId: 'thread-1',
          },
        ],
        total: 1,
      })),
      create: vi.fn(async (request) => ({
        id: 'conversation-1',
        threadId: request.threadId ?? 'thread-1',
        xpertId: request.xpertId,
        options: request.options,
      })),
      getGoal: vi.fn(async () => null),
      setGoal: vi.fn(async (_conversationId, request) => ({
        id: 'goal-1',
        conversationId: 'conversation-1',
        threadId: 'thread-1',
        objective: request.objective,
        status: 'active' as const,
        tokensUsed: 0,
        elapsedSeconds: 0,
        continuationCount: 0,
      })),
      updateGoal: vi.fn(async (_conversationId, request) => ({
        id: 'goal-1',
        conversationId: 'conversation-1',
        threadId: 'thread-1',
        objective: request.objective ?? 'ship feature',
        status: (request.status ?? 'active') as ThreadGoal['status'],
        tokensUsed: 0,
        elapsedSeconds: 0,
        continuationCount: 0,
      })),
      clearGoal: vi.fn(async () => null),
    },
  };
}

describe('thread goals', () => {
  it('parses /goal subcommands', () => {
    expect(parseGoalCommand('')).toEqual({ type: 'show' });
    expect(parseGoalCommand('pause')).toEqual({ type: 'pause' });
    expect(parseGoalCommand('resume')).toEqual({ type: 'resume' });
    expect(parseGoalCommand('clear')).toEqual({ type: 'clear' });
    expect(parseGoalCommand('edit ship next')).toEqual({
      type: 'edit',
      objective: 'ship next',
    });
    expect(parseGoalCommand('ship feature')).toEqual({
      type: 'set',
      objective: 'ship feature',
    });
  });

  it('does not expose removed budget fields from parsed goal payloads', () => {
    const removedBudgetField = 'token' + 'Budget';

    expect(
      parseThreadGoal({
        id: 'goal-1',
        conversationId: 'conversation-1',
        threadId: 'thread-1',
        objective: 'ship feature',
        status: 'active',
        [removedBudgetField]: 5000,
        tokensUsed: 0,
        elapsedSeconds: 0,
        continuationCount: 0,
      }),
    ).not.toHaveProperty(removedBudgetField);
  });

  it('maps goal commands to a host goal adapter', async () => {
    const adapter = goalFixture();

    await executeThreadGoalCommand({
      goal: adapter,
      threadId: 'thread-1',
      assistantId: 'assistant-1',
      command: { type: 'set', objective: 'ship feature' },
    });
    await executeThreadGoalCommand({
      goal: adapter,
      threadId: 'thread-1',
      assistantId: 'assistant-1',
      command: { type: 'pause' },
    });
    await executeThreadGoalCommand({
      goal: adapter,
      threadId: 'thread-1',
      assistantId: 'assistant-1',
      command: { type: 'resume' },
    });
    await executeThreadGoalCommand({
      goal: adapter,
      threadId: 'thread-1',
      assistantId: 'assistant-1',
      command: { type: 'clear' },
    });

    expect(adapter.setGoal).toHaveBeenCalledWith({
      threadId: 'thread-1',
      assistantId: 'assistant-1',
      objective: 'ship feature',
      runtimeCapabilities: undefined,
      signal: undefined,
    });
    expect(adapter.updateGoal).toHaveBeenCalledWith({
      threadId: 'thread-1',
      status: 'paused',
      signal: undefined,
    });
    expect(adapter.updateGoal).toHaveBeenCalledWith({
      threadId: 'thread-1',
      status: 'active',
      signal: undefined,
    });
    expect(adapter.clearGoal).toHaveBeenCalledWith({
      threadId: 'thread-1',
      signal: undefined,
    });
  });

  it('lets the adapter create the first goal without submitting a prompt', async () => {
    const adapter = goalFixture();

    const result = await executeThreadGoalCommand({
      goal: adapter,
      threadId: null,
      assistantId: 'assistant-1',
      command: { type: 'set', objective: 'ship feature' },
      runtimeCapabilities: {
        mode: 'allowlist',
        skills: { ids: [] },
        plugins: { nodeKeys: ['ralph-loop'] },
      },
    });

    expect(result.threadId).toBe('thread-new');
    expect(adapter.setGoal).toHaveBeenCalledWith({
      threadId: null,
      assistantId: 'assistant-1',
      objective: 'ship feature',
      runtimeCapabilities: {
        mode: 'allowlist',
        skills: { ids: [] },
        plugins: { nodeKeys: ['ralph-loop'] },
      },
      signal: undefined,
    });
  });

  it('parses thread goals without requiring backend-specific conversation ids', () => {
    expect(
      parseThreadGoal({
        id: 'goal-1',
        threadId: 'thread-1',
        objective: 'ship feature',
        status: 'active',
      }),
    ).toMatchObject({
      threadId: 'thread-1',
      objective: 'ship feature',
      status: 'active',
    });
  });

  it('parses partial thread goal update events', () => {
    expect(
      parseThreadGoalUpdatedPatchEvent({
        type: 'thread_goal_updated',
        goal: {
          id: 'goal-1',
          status: 'complete',
        },
        updatedAt: '2026-03-12T00:00:00.000Z',
      }),
    ).toMatchObject({
      goalId: 'goal-1',
      goal: {
        id: 'goal-1',
        status: 'complete',
      },
    });
  });
});

describe('xpert thread goal adapter', () => {
  it('only enables the default adapter when the SDK exposes goal methods', () => {
    const client = xpertGoalClientFixture();

    expect(supportsXpertThreadGoalAdapter(client)).toBe(true);

    delete client.conversations.setGoal;
    expect(supportsXpertThreadGoalAdapter(client)).toBe(false);
  });

  it('maps adapter calls to SDK conversation goal methods', async () => {
    const client = xpertGoalClientFixture();
    const adapter = createXpertThreadGoalAdapter(client);

    await adapter.setGoal({
      threadId: 'thread-1',
      assistantId: 'assistant-1',
      objective: 'ship feature',
    });
    await adapter.updateGoal({ threadId: 'thread-1', status: 'paused' });
    await adapter.updateGoal({ threadId: 'thread-1', status: 'active' });
    await adapter.clearGoal({ threadId: 'thread-1' });

    expect(client.conversations.setGoal).toHaveBeenCalledWith(
      'conversation-1',
      { objective: 'ship feature' },
      { signal: undefined },
    );
    expect(client.conversations.updateGoal).toHaveBeenCalledWith(
      'conversation-1',
      { status: 'paused' },
      { signal: undefined },
    );
    expect(client.conversations.updateGoal).toHaveBeenCalledWith(
      'conversation-1',
      { status: 'active' },
      { signal: undefined },
    );
    expect(client.conversations.clearGoal).toHaveBeenCalledWith(
      'conversation-1',
      { signal: undefined },
    );
  });

  it('preserves SDK method bindings when calling goal methods', async () => {
    type BoundConversationClient = XpertGoalClient['conversations'] & {
      calls: string[];
    };
    type BoundThreadsClient = NonNullable<XpertGoalClient['threads']> & {
      calls: string[];
    };

    const conversations: BoundConversationClient = {
      calls: [],
      async search(this: BoundConversationClient) {
        this.calls.push('search');
        return {
          items: [{ id: 'conversation-1', threadId: 'thread-1' }],
          total: 1,
        };
      },
      async create(
        this: BoundConversationClient,
        request: Parameters<
          NonNullable<XpertGoalClient['conversations']['create']>
        >[0],
      ) {
        this.calls.push('create');
        return {
          id: 'conversation-2',
          threadId: request.threadId ?? 'thread-new',
          xpertId: request.xpertId,
          options: request.options,
        };
      },
      async getGoal(this: BoundConversationClient, conversationId: string) {
        this.calls.push(`get:${conversationId}`);
        return null;
      },
      async setGoal(
        this: BoundConversationClient,
        conversationId: string,
        request: { objective: string },
      ) {
        this.calls.push(`set:${conversationId}`);
        return {
          id: 'goal-1',
          conversationId,
          threadId: 'thread-1',
          objective: request.objective,
          status: 'active',
          tokensUsed: 0,
          elapsedSeconds: 0,
          continuationCount: 0,
        } as const;
      },
      async updateGoal(
        this: BoundConversationClient,
        conversationId: string,
        request: { objective?: string; status?: 'active' | 'paused' },
      ) {
        this.calls.push(`update:${conversationId}:${request.status ?? ''}`);
        return {
          id: 'goal-1',
          conversationId,
          threadId: 'thread-1',
          objective: request.objective ?? 'ship feature',
          status: request.status ?? 'active',
          tokensUsed: 0,
          elapsedSeconds: 0,
          continuationCount: 0,
        } as const;
      },
      async clearGoal(this: BoundConversationClient, conversationId: string) {
        this.calls.push(`clear:${conversationId}`);
        return null;
      },
    };
    const threads: BoundThreadsClient = {
      calls: [],
      async create(this: BoundThreadsClient) {
        this.calls.push('create-thread');
        return sdkThreadFixture('thread-new');
      },
    };
    const adapter = createXpertThreadGoalAdapter({
      threads,
      conversations,
    });

    await adapter.getGoal({ threadId: 'thread-1' });
    await adapter.setGoal({
      threadId: 'thread-1',
      assistantId: 'assistant-1',
      objective: 'ship feature',
    });
    await adapter.updateGoal({ threadId: 'thread-1', status: 'paused' });
    await adapter.clearGoal({ threadId: 'thread-1' });
    await adapter.setGoal({
      threadId: null,
      assistantId: 'assistant-1',
      objective: 'start fresh',
    });

    expect(conversations.calls).toEqual([
      'search',
      'get:conversation-1',
      'search',
      'set:conversation-1',
      'search',
      'update:conversation-1:paused',
      'search',
      'clear:conversation-1',
      'create',
      'set:conversation-2',
    ]);
    expect(threads.calls).toEqual([]);
  });

  it('creates only one conversation before setting the first goal', async () => {
    const client = xpertGoalClientFixture();
    const adapter = createXpertThreadGoalAdapter(client);

    const result = await adapter.setGoal({
      threadId: null,
      assistantId: 'assistant-1',
      objective: 'ship feature',
      runtimeCapabilities: {
        mode: 'allowlist',
        skills: { ids: [] },
        plugins: { nodeKeys: ['ralph-loop'] },
      },
    });

    expect(result.threadId).toBe('thread-1');
    expect(client.threads?.create).not.toHaveBeenCalled();
    expect(client.conversations.create).toHaveBeenCalledWith({
      xpertId: 'assistant-1',
      options: {
        runtimeCapabilities: {
          mode: 'allowlist',
          skills: { ids: [] },
          plugins: { nodeKeys: ['ralph-loop'] },
        },
      },
    });
    expect(client.conversations.setGoal).toHaveBeenCalledWith(
      'conversation-1',
      { objective: 'ship feature' },
      { signal: undefined },
    );
  });
});
