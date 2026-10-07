import * as React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client, type Run } from '@xpert-ai/xpert-sdk';
import { ExternalAssistantView } from './ExternalAssistantView';
import type { ExternalAssistantRun } from './external-assistant-runs';

vi.mock('../../hooks/useAssistantInfo', () => ({ useAssistantInfo: () => null }));
vi.mock('../../components/thread/MessageList', () => ({
  MessageList: () => null,
}));

afterEach(cleanup);

function fixture(selectedId: string | null = null) {
  const client = new Client({ apiUrl: 'https://example.test' });
  const cancel = vi.spyOn(client.runs, 'cancel').mockResolvedValue(undefined);
  const get = vi
    .spyOn(client.runs, 'get')
    .mockImplementation(async (_thread, id) => snapshot(id, 'running'));
  const onSelect = vi.fn();
  const onRunUpdate = vi.fn();
  const runs: ExternalAssistantRun[] = [
    {
      id: 'writer',
      info: { id: 'writer', title: 'Writer', status: 'running' },
      segments: [],
    },
    {
      id: 'images',
      info: { id: 'images', title: 'Images', status: 'running' },
      segments: [],
    },
    {
      id: 'done',
      info: { id: 'done', title: 'Reviewer', status: 'success' },
      segments: [],
    },
  ];
  const props = {
    client,
    threadId: 'thread',
    runs,
    selectedId,
    onSelect,
    onRunUpdate,
    messages: [],
    onLoadMore: vi.fn(),
  };
  return {
    ...render(<ExternalAssistantView {...props} />),
    props,
    cancel,
    get,
    onRunUpdate,
    onSelect,
  };
}

describe('external assistant cancellation', () => {
  it('cancels only the selected running execution without opening it or cancelling the parent', async () => {
    const f = fixture();
    let finish!: () => void;
    f.cancel.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const button = screen.getByRole('button', {
      name: /Cancel execution: Writer/i,
    });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(f.cancel).toHaveBeenCalledExactlyOnceWith('thread', 'writer', false);
    expect(f.onSelect).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /Cancel execution: Images/i }),
    ).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: /Cancel execution: Reviewer/i }),
    ).not.toBeInTheDocument();
    await act(async () => finish());
    expect(button).toBeDisabled();
    f.rerender(
      <ExternalAssistantView
        {...f.props}
        runs={f.props.runs.map((run) =>
          run.id === 'writer'
            ? {
                ...run,
                info: {
                  ...run.info,
                  status: 'interrupted',
                  error: 'Cancelled by user',
                },
              }
            : run,
        )}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /Cancel execution: Writer/i }),
    ).not.toBeInTheDocument();
  });

  it('offers the same cancellation in the execution detail and allows retry after API failure', async () => {
    const f = fixture('images');
    f.cancel.mockRejectedValueOnce(new Error('Permission denied'));
    fireEvent.click(
      screen.getByRole('button', { name: /Cancel execution: Images/i }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Permission denied',
    );
    const button = screen.getByRole('button', {
      name: /Cancel execution: Images/i,
    });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(f.cancel).toHaveBeenCalledTimes(2));
    expect(f.cancel).toHaveBeenLastCalledWith('thread', 'images', false);
    expect(f.onSelect).not.toHaveBeenCalled();
  });

  it('does not offer cancellation without an authenticated client and thread', () => {
    const f = fixture();
    f.rerender(<ExternalAssistantView {...f.props} threadId={null} />);
    expect(
      screen.queryByRole('button', { name: /Cancel execution:/i }),
    ).not.toBeInTheDocument();
    f.rerender(<ExternalAssistantView {...f.props} client={null} />);
    expect(
      screen.queryByRole('button', { name: /Cancel execution:/i }),
    ).not.toBeInTheDocument();
  });
});

function snapshot(id: string, status: Run['status']): Run {
  return {
    run_id: id,
    thread_id: 'thread',
    assistant_id: 'assistant',
    status,
    created_at: '2026-10-02T08:00:00.000Z',
    updated_at: '2026-10-02T08:45:00.000Z',
    metadata: {
      agentRun: {
        id,
        status,
        elapsedTime: 2700000,
        error: status === 'interrupted' ? 'Cancelled by user' : undefined,
      },
    },
    multitask_strategy: 'reject',
  };
}

describe('reconcile cancellation without an SSE end event', () => {
  it('reads the persisted status after cancel and updates the row, duration and shared conversation', async () => {
    const f = fixture();
    await waitFor(() => expect(f.get).toHaveBeenCalledTimes(2));
    f.get.mockImplementation(async (_thread, id) =>
      snapshot(id, id === 'writer' ? 'interrupted' : 'running'),
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Cancel execution: Writer/i }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /Cancel execution: Writer/i }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Interrupted')).toBeInTheDocument();
    expect(screen.getByText('45m 0s')).toBeInTheDocument();
    expect(f.onRunUpdate).toHaveBeenCalledWith(
      'thread',
      expect.objectContaining({
        id: 'writer',
        status: 'interrupted',
        elapsedTime: 2700000,
      }),
    );
    expect(
      screen.getByRole('button', { name: /Cancel execution: Images/i }),
    ).toBeEnabled();
    f.rerender(<ExternalAssistantView {...f.props} selectedId="writer" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Cancelled by user');
    expect(f.cancel).toHaveBeenCalledTimes(1);
  });

  it('does not claim a successful cancellation when the server still reports running', async () => {
    const f = fixture();
    fireEvent.click(
      screen.getByRole('button', { name: /Cancel execution: Writer/i }),
    );
    await screen.findByText('Cancellation requested');
    expect(screen.getAllByText('Running')).toHaveLength(2);
    expect(f.onRunUpdate).not.toHaveBeenCalled();
    f.get.mockRejectedValue(new Error('Network unavailable'));
    f.rerender(<ExternalAssistantView {...f.props} active={false} />);
    f.rerender(<ExternalAssistantView {...f.props} active />);
    await act(async () => {});
    expect(f.onRunUpdate).not.toHaveBeenCalled();
  });
});
