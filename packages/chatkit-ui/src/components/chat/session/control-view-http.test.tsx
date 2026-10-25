// Optional paired-repository acceptance, driven by the server's isolated HTTP/PostgreSQL fixture.
import * as React from 'react';
import { transferableAbortController } from 'node:util';
import { act, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Client } from '@xpert-ai/xpert-sdk';
import { useThreadBranches } from '../../../hooks/useThreadBranches';
import { ReadRecovery } from '../../../providers/stream/connection/read-recovery';
import { useChatRunControl } from './useChatRunControl';
const endpoint = process.env.XPERT_CONTROL_HTTP_ENDPOINT;
it.skipIf(!endpoint)(
  'HTTP → persistent evidence → SDK → visible ChatKit controls survives 503 and refresh',
  async () => {
    const identity: { threadId: string; runId: string } = await (
      await fetch(`${endpoint}/test/identity`)
    ).json();
    const { threadId, runId } = identity;
    // Node fetch requires its own AbortSignal realm; bridge jsdom's signal without disabling cancellation.
    const transport: typeof fetch = async (url, init) => {
      const controller = transferableAbortController();
      const abort = () => controller.abort(init?.signal?.reason);
      if (init?.signal?.aborted) abort();
      init?.signal?.addEventListener('abort', abort, { once: true });
      try {
        return await fetch(url, { ...init, signal: controller.signal });
      } finally {
        init?.signal?.removeEventListener('abort', abort);
      }
    };
    const client = new Client({
      apiUrl: endpoint,
      callerOptions: { maxRetries: 0, fetch: transport },
    });
    expect(await client.threads.getControlView(threadId)).toMatchObject({
      state: 'running',
    });
    expect(await client.conversations.listThreads('conversation')).toHaveLength(
      1,
    );
    const recovery = new ReadRecovery();
    let inFlight = 0,
      maxInFlight = 0;
    const read = (id: string) =>
      recovery.read(`control:${id}`, async (signal) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        try {
          return await client.threads.getControlView(id, { signal });
        } finally {
          inFlight--;
        }
      });
    const list = () =>
      recovery.read('branches', (signal) =>
        client.conversations.listThreads('conversation', { signal }),
      );
    const stop = vi.fn(() => client.runs.cancel(threadId, runId));
    function Controls() {
      const branchState = useThreadBranches(
        client,
        'conversation',
        threadId,
        true,
        false,
        list,
        read,
      );
      const connectionState = React.useSyncExternalStore(
        recovery.subscribe,
        recovery.getSnapshot,
      );
      const control = useChatRunControl({
        branchState,
        isChangingBranch: false,
        activeBranchRef: { current: threadId },
        stream: {
          threadId,
          activeRunId: runId,
          isLoading: false,
          isThreadInterrupted: true,
          connectionState,
          stop,
          pauseRun: vi.fn(),
          resumeRun: vi.fn(),
        },
      });
      return (
        <div>
          <span data-testid="error">{branchState.error}</span>
          <span data-testid="state">{control.controlStatus}</span>
          <span data-testid="connection">{connectionState}</span>
          <button
            disabled={!control.canStopRun}
            onClick={() => void control.handleComposerRunControl('stop')}
          >
            停止
          </button>
          <button disabled={!control.canSubmit}>发送</button>
          <button disabled={!control.canResumeRun}>继续</button>
        </div>
      );
    }
    let ui = render(<Controls />);
    try {
      await waitFor(() =>
        expect(screen.getByTestId('state')).toHaveTextContent('running'),
      );
      await act(async () => {
        screen.getByText('停止').click();
      });
      await waitFor(() =>
        expect(screen.getByTestId('state')).toHaveTextContent('stopping'),
      );
      expect(screen.getByText('发送')).toBeDisabled();
      expect(screen.getByText('继续')).toBeDisabled();
      expect(screen.getByText('停止')).toBeDisabled();
      ui.unmount();
      ui = render(<Controls />);
      await waitFor(() =>
        expect(screen.getByTestId('state')).toHaveTextContent('stopping'),
      );
      await fetch(`${endpoint}/test/outage`, { method: 'POST' });
      await waitFor(
        () =>
          expect(screen.getByTestId('connection')).toHaveTextContent(
            'unavailable',
          ),
        { timeout: 12_000 },
      );
      expect(screen.getByTestId('state')).toHaveTextContent('stopping');
      expect(screen.getByText('发送')).toBeDisabled();
      await waitFor(
        () =>
          expect(screen.getByTestId('connection')).toHaveTextContent(
            'connected',
          ),
        { timeout: 12_000 },
      );
      expect(screen.getByTestId('state')).toHaveTextContent('stopping');
      const completed = await (
        await fetch(`${endpoint}/test/release`, { method: 'POST' })
      ).json();
      expect(completed.calls).toBe(1);
      await waitFor(
        () => expect(screen.getByTestId('state')).toHaveTextContent('stopped'),
        { timeout: 5000 },
      );
      expect(screen.getByText('发送')).toBeEnabled();
      expect(screen.getByText('继续')).toBeDisabled();
      expect(stop).toHaveBeenCalledTimes(1);
      expect(maxInFlight).toBe(1);
      console.info(
        'Paired HTTP acceptance: stopping during 3×503 and refresh → stopped only after tool exit; calls=1; maxConcurrentControlReads=1',
      );
    } finally {
      ui.unmount();
      recovery.dispose();
    }
  },
  40_000,
);
