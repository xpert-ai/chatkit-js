import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContextUsageIndicator } from './context-usage-indicator';
import { useStreamContext } from '../../providers/Stream';

vi.mock('../../providers/Stream', () => ({
  useStreamContext: vi.fn(),
}));

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../ui/progress-circle', () => ({
  ProgressCircle: ({ value }: { value: number }) => (
    <div data-testid="progress-circle" data-value={value} />
  ),
}));

vi.mock('../ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

const mockUseStreamContext = vi.mocked(useStreamContext);

function createStream(overrides: Record<string, unknown> = {}) {
  return {
    apiKey: 'secret',
    apiUrl: '/api/ai',
    assistantId: 'assistant-1',
    client: {
      assistants: {
        get: vi.fn().mockResolvedValue({
          metadata: {
            context_size: 1000,
            agent_key: 'agent-1',
          },
        }),
      },
      threads: {
        getContextUsage: vi.fn().mockResolvedValue({
          usage: {
            context_tokens: 100,
          },
        }),
      },
    },
    contextUsageByAgentKey: {},
    threadId: null,
    isLoading: false,
    ...overrides,
  };
}

describe('ContextUsageIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the realtime model window and falls back for older events', async () => {
    const event = {
      type: 'thread_context_usage',
      threadId: 'thread-1',
      agentKey: 'agent-1',
      runId: 'run-1',
      updatedAt: '2026-09-09T00:00:00Z',
      usage: {
        contextTokens: 2000,
        inputTokens: 2000,
        outputTokens: 0,
        totalTokens: 2000,
      },
      effectiveModel: { model: 'fallback', contextWindow: 4000 },
    };
    const stream = createStream({
      threadId: 'thread-1',
      contextUsageByAgentKey: { 'agent-1': event },
    });
    mockUseStreamContext.mockReturnValue(
      stream as unknown as ReturnType<typeof useStreamContext>,
    );
    const { rerender } = render(<ContextUsageIndicator />);
    await waitFor(() =>
      expect(screen.getByTestId('progress-circle')).toHaveAttribute(
        'data-value',
        '50',
      ),
    );

    mockUseStreamContext.mockReturnValue({
      ...stream,
      contextUsageByAgentKey: {
        'agent-1': { ...event, effectiveModel: undefined },
      },
    } as unknown as ReturnType<typeof useStreamContext>);
    rerender(<ContextUsageIndicator />);
    await waitFor(() =>
      expect(screen.getByTestId('progress-circle')).toHaveAttribute(
        'data-value',
        '100',
      ),
    );
  });

  it('does not load assistant context size before the client secret is ready', () => {
    const stream = createStream({ apiKey: '' });
    mockUseStreamContext.mockReturnValue(
      stream as unknown as ReturnType<typeof useStreamContext>,
    );

    render(<ContextUsageIndicator />);

    expect(stream.client.assistants.get).not.toHaveBeenCalled();
    expect(stream.client.threads.getContextUsage).not.toHaveBeenCalled();
  });

  it('loads assistant context size once API configuration is available', async () => {
    const stream = createStream();
    mockUseStreamContext.mockReturnValue(
      stream as unknown as ReturnType<typeof useStreamContext>,
    );

    render(<ContextUsageIndicator />);

    await waitFor(() => {
      expect(stream.client.assistants.get).toHaveBeenCalledWith('assistant-1');
    });
  });

  it('restores the last valid usage and its stale status after opening history', async () => {
    const stream = createStream({ threadId: 'thread-1' });
    stream.client.threads.getContextUsage.mockResolvedValue({
      status: 'stale',
      run_id: 'last-good-run',
      usage: { context_tokens: 320 },
    });
    mockUseStreamContext.mockReturnValue(
      stream as unknown as ReturnType<typeof useStreamContext>,
    );

    render(<ContextUsageIndicator />);

    await waitFor(() =>
      expect(screen.getByTestId('progress-circle')).toHaveAttribute(
        'data-value',
        '32',
      ),
    );
    expect(screen.getByRole('button')).toHaveAccessibleName(
      /chat.contextUsage.stale/,
    );
  });

  it('shows unavailable, without a zero-percent gauge, when no call produced usage', async () => {
    const stream = createStream({ threadId: 'thread-1' });
    stream.client.threads.getContextUsage.mockResolvedValue({
      status: 'unavailable',
      usage: { context_tokens: 0 },
    });
    mockUseStreamContext.mockReturnValue(
      stream as unknown as ReturnType<typeof useStreamContext>,
    );

    render(<ContextUsageIndicator />);

    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveAccessibleName(
        /chat.contextUsage.unavailable/,
      ),
    );
    expect(screen.queryByTestId('progress-circle')).not.toBeInTheDocument();
    expect(
      screen.queryByText('chat.contextUsage.tokensUsed'),
    ).not.toBeInTheDocument();
  });

  it('refreshes status after a failed turn even when a previous realtime measurement exists', async () => {
    const event = {
      type: 'thread_context_usage',
      threadId: 'thread-1',
      agentKey: 'agent-1',
      runId: 'last-good-run',
      updatedAt: '2026-09-18T04:57:00Z',
      usage: {
        contextTokens: 320,
        inputTokens: 320,
        outputTokens: 0,
        totalTokens: 320,
      },
    };
    const stream = createStream({
      threadId: 'thread-1',
      isLoading: true,
      contextUsageByAgentKey: { 'agent-1': event },
    });
    stream.client.threads.getContextUsage.mockResolvedValue({
      status: 'stale',
      run_id: 'last-good-run',
      usage: { context_tokens: 320 },
    });
    mockUseStreamContext.mockReturnValue(
      stream as unknown as ReturnType<typeof useStreamContext>,
    );
    const { rerender } = render(<ContextUsageIndicator />);
    await waitFor(() =>
      expect(screen.getByTestId('progress-circle')).toHaveAttribute(
        'data-value',
        '32',
      ),
    );

    mockUseStreamContext.mockReturnValue({
      ...stream,
      isLoading: false,
    } as unknown as ReturnType<typeof useStreamContext>);
    rerender(<ContextUsageIndicator />);

    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveAccessibleName(
        /chat.contextUsage.stale/,
      ),
    );
    expect(screen.getByTestId('progress-circle')).toHaveAttribute(
      'data-value',
      '32',
    );

    mockUseStreamContext.mockReturnValue({
      ...stream,
      contextUsageByAgentKey: {
        'agent-1': {
          ...event,
          runId: 'next-good-run',
          usage: {
            contextTokens: 400,
            inputTokens: 400,
            outputTokens: 0,
            totalTokens: 400,
          },
        },
      },
    } as unknown as ReturnType<typeof useStreamContext>);
    rerender(<ContextUsageIndicator />);
    await waitFor(() =>
      expect(screen.getByTestId('progress-circle')).toHaveAttribute(
        'data-value',
        '40',
      ),
    );
    expect(screen.getByRole('button')).not.toHaveAccessibleName(
      /chat.contextUsage.stale/,
    );
  });

  it('keeps a measured value when an older server returns zero after a failed call', async () => {
    const stream = createStream({ threadId: 'thread-1' });
    mockUseStreamContext.mockReturnValue(
      stream as unknown as ReturnType<typeof useStreamContext>,
    );
    const { rerender } = render(<ContextUsageIndicator />);
    await waitFor(() =>
      expect(screen.getByTestId('progress-circle')).toHaveAttribute(
        'data-value',
        '10',
      ),
    );

    mockUseStreamContext.mockReturnValue({
      ...stream,
      isLoading: true,
    } as unknown as ReturnType<typeof useStreamContext>);
    rerender(<ContextUsageIndicator />);
    stream.client.threads.getContextUsage.mockResolvedValue({
      usage: { context_tokens: 0 },
    });
    mockUseStreamContext.mockReturnValue(
      stream as unknown as ReturnType<typeof useStreamContext>,
    );
    rerender(<ContextUsageIndicator />);

    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveAccessibleName(
        /chat.contextUsage.stale/,
      ),
    );
    expect(screen.getByTestId('progress-circle')).toHaveAttribute(
      'data-value',
      '10',
    );
  });

  it('does not carry a value or an in-flight response into a different thread', async () => {
    const stream = createStream({ threadId: 'thread-1' });
    mockUseStreamContext.mockReturnValue(
      stream as unknown as ReturnType<typeof useStreamContext>,
    );
    const { rerender } = render(<ContextUsageIndicator />);
    await waitFor(() =>
      expect(screen.getByTestId('progress-circle')).toHaveAttribute(
        'data-value',
        '10',
      ),
    );

    let resolveOldRequest!: (value: {
      usage: { context_tokens: number };
    }) => void;
    stream.client.threads.getContextUsage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOldRequest = resolve;
        }),
    );
    mockUseStreamContext.mockReturnValue({
      ...stream,
      isLoading: true,
    } as unknown as ReturnType<typeof useStreamContext>);
    rerender(<ContextUsageIndicator />);
    mockUseStreamContext.mockReturnValue(
      stream as unknown as ReturnType<typeof useStreamContext>,
    );
    rerender(<ContextUsageIndicator />);
    await waitFor(() => expect(resolveOldRequest).toBeDefined());

    stream.client.threads.getContextUsage.mockResolvedValue({
      status: 'unavailable',
      usage: { context_tokens: 0 },
    });
    mockUseStreamContext.mockReturnValue({
      ...stream,
      threadId: 'thread-2',
    } as unknown as ReturnType<typeof useStreamContext>);
    rerender(<ContextUsageIndicator />);
    expect(screen.queryByTestId('progress-circle')).not.toBeInTheDocument();
    await act(async () =>
      resolveOldRequest({ usage: { context_tokens: 900 } }),
    );
    expect(screen.getByRole('button')).toHaveAccessibleName(
      /chat.contextUsage.unavailable/,
    );
    expect(screen.queryByTestId('progress-circle')).not.toBeInTheDocument();
  });

  it.each(['resolve', 'reject'])(
    'does not let a late query %s overwrite newer realtime usage',
    async (outcome) => {
      const stream = createStream({ threadId: 'thread-1' });
      let resolveRequest!: (value: {
        status: string;
        usage: { context_tokens: number };
      }) => void;
      let rejectRequest!: (error: Error) => void;
      stream.client.threads.getContextUsage.mockImplementation(
        () =>
          new Promise((resolve, reject) => {
            resolveRequest = resolve;
            rejectRequest = reject;
          }),
      );
      mockUseStreamContext.mockReturnValue(
        stream as unknown as ReturnType<typeof useStreamContext>,
      );
      const { rerender } = render(<ContextUsageIndicator />);
      await waitFor(() => expect(resolveRequest).toBeDefined());

      mockUseStreamContext.mockReturnValue({
        ...stream,
        contextUsageByAgentKey: {
          'agent-1': {
            type: 'thread_context_usage',
            threadId: 'thread-1',
            agentKey: 'agent-1',
            runId: 'new-run',
            updatedAt: '2026-09-18T05:00:00Z',
            usage: {
              contextTokens: 400,
              inputTokens: 400,
              outputTokens: 0,
              totalTokens: 400,
            },
          },
        },
      } as unknown as ReturnType<typeof useStreamContext>);
      rerender(<ContextUsageIndicator />);
      await waitFor(() =>
        expect(screen.getByTestId('progress-circle')).toHaveAttribute(
          'data-value',
          '40',
        ),
      );

      await act(async () => {
        if (outcome === 'resolve')
          resolveRequest({ status: 'stale', usage: { context_tokens: 100 } });
        else rejectRequest(new Error('late network error'));
      });
      expect(screen.getByTestId('progress-circle')).toHaveAttribute(
        'data-value',
        '40',
      );
      expect(screen.getByRole('button')).not.toHaveAccessibleName(
        /chat.contextUsage.stale/,
      );
    },
  );

  it('keeps the last reading and marks it stale when the usage query itself fails', async () => {
    const stream = createStream({ threadId: 'thread-1' });
    mockUseStreamContext.mockReturnValue(
      stream as unknown as ReturnType<typeof useStreamContext>,
    );
    const { rerender } = render(<ContextUsageIndicator />);
    await waitFor(() =>
      expect(screen.getByTestId('progress-circle')).toHaveAttribute(
        'data-value',
        '10',
      ),
    );
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      mockUseStreamContext.mockReturnValue({
        ...stream,
        isLoading: true,
      } as unknown as ReturnType<typeof useStreamContext>);
      rerender(<ContextUsageIndicator />);
      stream.client.threads.getContextUsage.mockRejectedValue(
        new Error('network error'),
      );
      mockUseStreamContext.mockReturnValue(
        stream as unknown as ReturnType<typeof useStreamContext>,
      );
      rerender(<ContextUsageIndicator />);
      await waitFor(() =>
        expect(screen.getByRole('button')).toHaveAccessibleName(
          /chat.contextUsage.stale/,
        ),
      );
      expect(screen.getByTestId('progress-circle')).toHaveAttribute(
        'data-value',
        '10',
      );
    } finally {
      warning.mockRestore();
    }
  });
});
