import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  createToolComponent,
  render,
  renderAssistant,
  type AssistantChatkitMessage,
} from './ai.test-fixture';
import { AssistantMessage } from './ai';

describe('AssistantMessage tool components', () => {
  it('shows a finished tool duration from created_date to end_date', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-04-24T12:24:54.398Z'));

    render(
      <AssistantMessage
        message={
          {
            id: 'assistant-1',
            type: 'assistant',
            content: [
              {
                id: 'tool-1',
                type: 'component',
                data: {
                  category: 'Tool',
                  toolset: 'todoListMiddleware',
                  tool: 'write_todos',
                  title: 'write_todos',
                  created_date: '2026-04-24T12:24:52.898Z',
                  end_date: '2026-04-24T12:24:54.398Z',
                  status: 'success',
                },
              },
            ],
          } as AssistantChatkitMessage
        }
      />,
    );

    expect(screen.getByText('1.5s')).toBeInTheDocument();
  });

  it('shows the tool icon for completed tool rows instead of a status check', () => {
    const { container } = renderAssistant([
      createToolComponent('run-command', {
        type: 'program',
        title: 'run-command',
        status: 'success',
      }),
    ]);

    expect(
      container.querySelector('[data-slot="tool-step-icon"]'),
    ).toBeInTheDocument();
  });

  it('uses a trusted tool-specific inline SVG icon before fallback icons', () => {
    const { container } = renderAssistant([
      createToolComponent('view-images', {
        type: 'tool',
        title: 'View governed source images',
        status: 'success',
        icon: {
          type: 'svg',
          value:
            '<svg viewBox="0 0 24 24" data-icon="eye"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
        },
      }),
    ]);

    expect(
      container.querySelector('[data-slot="tool-step-icon"] [data-icon="eye"]'),
    ).toBeInTheDocument();
  });

  it('uses smaller density-aware text for grouped tool rows', () => {
    renderAssistant([
      createToolComponent('run-command', {
        type: 'program',
        title: 'run-command',
        status: 'success',
      }),
    ]);

    expect(screen.getByRole('button', { name: /run-command/ })).toHaveClass(
      'text-xs',
      'leading-5',
      'in-data-[density=compact]:text-[11px]',
      'in-data-[density=compact]:leading-4',
      'in-data-[density=spacious]:text-[13px]',
      'in-data-[density=spacious]:leading-5',
    );
  });

  it('adds a shimmer text effect to running grouped tool rows', () => {
    renderAssistant([
      createToolComponent('run-command', {
        type: 'program',
        title: 'run-command',
        status: 'running',
        end_date: undefined,
      }),
    ]);

    expect(screen.getByText('run-command')).toHaveClass(
      'ck-tool-call-running-text',
    );
  });

  it('uses the tool icon for running tool rows instead of a loading indicator', () => {
    const { container } = renderAssistant([
      createToolComponent('run-command', {
        type: 'program',
        title: 'run-command',
        status: 'running',
        end_date: undefined,
      }),
    ]);

    expect(
      container.querySelector('[data-slot="tool-step-icon"]'),
    ).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).not.toBeInTheDocument();
  });

  it('uses the builtin provider icon URL for provider toolsets', () => {
    const { container } = render(
      <AssistantMessage
        message={
          {
            id: 'assistant-1',
            type: 'assistant',
            content: [
              createToolComponent('search-web', {
                type: 'tool',
                toolset: 'tavily',
                title: 'search-web',
                status: 'success',
              }),
            ],
          } as AssistantChatkitMessage
        }
        apiUrl="https://api.example.com/api/ai"
        organizationId="org-1"
      />,
    );

    expect(
      container.querySelector('img[data-slot="tool-step-icon"]'),
    ).toHaveAttribute(
      'src',
      'https://api.example.com/api/xpert-toolset/builtin-provider/tavily/icon?org=org-1',
    );
  });

  it('uses the provider icon URL for middleware toolsets before the step type icon', () => {
    const { container } = render(
      <AssistantMessage
        message={
          {
            id: 'assistant-1',
            type: 'assistant',
            content: [
              createToolComponent('host_page_snapshot', {
                type: 'program',
                toolset: 'browser-automation',
                title: 'host_page_snapshot',
                status: 'success',
              }),
            ],
          } as AssistantChatkitMessage
        }
        apiUrl="https://api.example.com/api/ai"
        organizationId="org-1"
      />,
    );

    expect(
      container.querySelector('img[data-slot="tool-step-icon"]'),
    ).toHaveAttribute(
      'src',
      'https://api.example.com/api/xpert-toolset/builtin-provider/browser-automation/icon?org=org-1',
    );
  });

  it('falls back to the step type icon when the provider icon URL fails', async () => {
    const { container } = render(
      <AssistantMessage
        message={
          {
            id: 'assistant-1',
            type: 'assistant',
            content: [
              createToolComponent('host_page_snapshot', {
                type: 'program',
                toolset: 'browser-automation',
                title: 'host_page_snapshot',
                status: 'success',
              }),
            ],
          } as AssistantChatkitMessage
        }
        apiUrl="https://api.example.com/api/ai"
      />,
    );

    const icon = container.querySelector('img[data-slot="tool-step-icon"]');
    if (!(icon instanceof HTMLImageElement)) {
      throw new Error('Expected a provider icon image.');
    }
    fireEvent.error(icon);

    await waitFor(() => {
      expect(
        container.querySelector('img[data-slot="tool-step-icon"]'),
      ).not.toBeInTheDocument();
    });
    expect(
      container.querySelector('svg[data-slot="tool-step-icon"]'),
    ).toBeInTheDocument();
  });

  it('marks stale running tools as failed without inventing a duration when the thread is idle', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-04-24T12:24:54.398Z'));

    render(
      <AssistantMessage
        message={{
          id: 'assistant-1',
          type: 'assistant',
          content: [
            {
              id: 'tool-1',
              type: 'component',
              data: {
                category: 'Tool',
                toolset: 'todoListMiddleware',
                tool: 'write_todos',
                title: 'write_todos',
                message: 'Writing todos',
                created_date: '2026-04-24T12:24:52.898Z',
                status: 'running',
              },
            },
          ],
        }}
        isThreadRunning={false}
      />,
    );

    expect(
      screen.getByRole('button', { name: /Processed 1 task/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Processing failed 1 task/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Writing todos')).toBeInTheDocument();
    expect(screen.queryByText('write_todos')).not.toBeInTheDocument();
    expect(screen.queryByText('1.5s')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.queryByText('1.5s')).not.toBeInTheDocument();
    expect(screen.queryByText('2.5s')).not.toBeInTheDocument();
  });

  it('keeps an unfinished tool neutral with unknown duration while paused', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-04-24T12:24:54.398Z'));

    renderAssistant(
      [
        createToolComponent('shell-paused', {
          tool: 'sandbox_shell',
          title: 'sandbox_shell',
          input: { command: 'sleep 30' },
          status: 'running',
          end_date: undefined,
        }),
      ],
      {},
      { isThreadRunning: false, isThreadPaused: true },
    );

    const row = screen.getByRole('button', { name: /Running sleep 30/ });
    expect(row).not.toHaveClass('text-destructive');
    expect(
      row.querySelector('.ck-tool-call-running-text'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('1.5s')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.queryByText('1.5s')).not.toBeInTheDocument();

    fireEvent.click(row);
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.queryByText('Running')).not.toBeInTheDocument();
  });

  it('updates the running tool duration over time', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-04-24T12:24:54.398Z'));

    render(
      <AssistantMessage
        message={{
          id: 'assistant-1',
          type: 'assistant',
          content: [
            {
              id: 'tool-1',
              type: 'component',
              data: {
                category: 'Tool',
                toolset: 'todoListMiddleware',
                tool: 'write_todos',
                title: 'write_todos',
                created_date: '2026-04-24T12:24:52.898Z',
                status: 'running',
              },
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('1.5s')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByText('2.5s')).toBeInTheDocument();
  });
});
