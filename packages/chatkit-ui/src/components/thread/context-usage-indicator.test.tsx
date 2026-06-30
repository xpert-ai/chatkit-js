import { render, waitFor } from '@testing-library/react';
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
  ProgressCircle: () => <div data-testid="progress-circle" />,
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
});
