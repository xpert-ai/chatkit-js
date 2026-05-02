import * as React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import type { Client, SandboxManagedService } from '@xpert-ai/xpert-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SANDBOX_SERVICES_RUNNING_POLL_INTERVAL_MS,
  SANDBOX_SERVICES_TRANSITION_POLL_INTERVAL_MS,
} from '../lib/runtime-activity';
import { useRuntimeActivities } from './runtime-activities';

const runningService: SandboxManagedService = {
  id: 'service-1',
  conversationId: 'conversation-1',
  provider: 'local-shell-sandbox',
  name: 'web',
  command: 'pnpm dev',
  workingDirectory: '/workspace',
  status: 'running',
  startedAt: '2026-05-02T08:00:00.000Z',
};

function createClient(services: SandboxManagedService[] = []) {
  return {
    sandbox: {
      listThreadServices: vi.fn().mockResolvedValue(services),
      stopThreadService: vi.fn().mockResolvedValue(runningService),
    },
  } as unknown as Client<{ messages: unknown[] }>;
}

const getOrganizationId = () => 'org-1';
const setError = vi.fn();

function RuntimeActivitiesHarness({
  client,
  enabled = true,
  threadId,
}: {
  client: Client<{ messages: unknown[] }>;
  enabled?: boolean;
  threadId: string | null;
}) {
  useRuntimeActivities({
    client,
    enabled,
    threadId,
    getOrganizationId,
    setError,
  });

  return null;
}

async function waitForListThreadServicesCallCount(
  client: Client<{ messages: unknown[] }>,
  expectedCallCount: number,
) {
  await act(async () => {
    await vi.waitFor(() => {
      expect(client.sandbox.listThreadServices).toHaveBeenCalledTimes(
        expectedCallCount,
      );
    });
  });
}

async function waitForPollingTimer() {
  for (let index = 0; index < 3; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
  expect(vi.getTimerCount()).toBeGreaterThan(0);
}

describe('useRuntimeActivities', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('hydrates sandbox services when an active thread is available', async () => {
    const client = createClient();

    render(<RuntimeActivitiesHarness client={client} threadId="thread-1" />);

    await waitFor(() => {
      expect(client.sandbox.listThreadServices).toHaveBeenCalledWith(
        'thread-1',
        expect.objectContaining({
          organizationId: 'org-1',
          signal: expect.any(AbortSignal),
        }),
      );
    });
  });

  it('waits for runtime activities to be enabled before hydrating services', async () => {
    const client = createClient();
    const { rerender } = render(
      <RuntimeActivitiesHarness
        client={client}
        enabled={false}
        threadId="thread-1"
      />,
    );

    expect(client.sandbox.listThreadServices).not.toHaveBeenCalled();

    rerender(
      <RuntimeActivitiesHarness
        client={client}
        enabled
        threadId="thread-1"
      />,
    );

    await waitFor(() => {
      expect(client.sandbox.listThreadServices).toHaveBeenCalledTimes(1);
    });
  });

  it('hydrates again when the active thread changes', async () => {
    const client = createClient();
    const { rerender } = render(
      <RuntimeActivitiesHarness client={client} threadId="thread-1" />,
    );

    await waitFor(() => {
      expect(client.sandbox.listThreadServices).toHaveBeenCalledWith(
        'thread-1',
        expect.any(Object),
      );
    });

    rerender(<RuntimeActivitiesHarness client={client} threadId="thread-2" />);

    await waitFor(() => {
      expect(client.sandbox.listThreadServices).toHaveBeenCalledWith(
        'thread-2',
        expect.any(Object),
      );
    });
  });

  it('polls running sandbox services with a slow refresh interval', async () => {
    vi.useFakeTimers();
    const client = createClient([runningService]);

    render(<RuntimeActivitiesHarness client={client} threadId="thread-1" />);

    await waitForListThreadServicesCallCount(client, 1);
    await waitForPollingTimer();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        SANDBOX_SERVICES_RUNNING_POLL_INTERVAL_MS - 1,
      );
    });
    expect(client.sandbox.listThreadServices).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    await waitForListThreadServicesCallCount(client, 2);
  });

  it('polls transitioning sandbox services with a fast refresh interval', async () => {
    vi.useFakeTimers();
    const startingService: SandboxManagedService = {
      ...runningService,
      id: 'service-starting',
      status: 'starting',
    };
    const client = createClient([startingService]);

    render(<RuntimeActivitiesHarness client={client} threadId="thread-1" />);

    await waitForListThreadServicesCallCount(client, 1);
    await waitForPollingTimer();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        SANDBOX_SERVICES_TRANSITION_POLL_INTERVAL_MS - 1,
      );
    });
    expect(client.sandbox.listThreadServices).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    await waitForListThreadServicesCallCount(client, 2);
  });

  it('pauses sandbox service polling while the page is hidden', async () => {
    vi.useFakeTimers();
    let visibilityState: DocumentVisibilityState = 'hidden';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });
    const client = createClient([runningService]);

    render(<RuntimeActivitiesHarness client={client} threadId="thread-1" />);

    await waitForListThreadServicesCallCount(client, 1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        SANDBOX_SERVICES_RUNNING_POLL_INTERVAL_MS * 2,
      );
    });
    expect(client.sandbox.listThreadServices).toHaveBeenCalledTimes(1);

    visibilityState = 'visible';
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitForListThreadServicesCallCount(client, 2);
  });
});
