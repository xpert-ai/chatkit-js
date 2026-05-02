import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  RUNTIME_ACTIVITY_SANDBOX_SERVICES_PROVIDER_ID,
  SANDBOX_SERVICES_RUNNING_POLL_INTERVAL_MS,
  SANDBOX_SERVICES_TRANSITION_POLL_INTERVAL_MS,
  filterActiveSandboxServices,
  getSandboxServicesPollingIntervalMs,
  hasTransitioningSandboxServices,
  resolveRuntimeActivityTriggerFromMessageComponent,
  type SandboxManagedService,
} from './runtime-activity';

function createService(
  status: SandboxManagedService['status'],
  overrides?: Partial<SandboxManagedService>,
): SandboxManagedService {
  return {
    id: `${status}-service`,
    conversationId: 'conversation-1',
    provider: 'local-shell-sandbox',
    name: status,
    command: 'npm run dev',
    workingDirectory: '/workspace/project-1',
    status,
    ...overrides,
  };
}

describe('runtime activity helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detects sandbox service tool message components', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);

    expect(
      resolveRuntimeActivityTriggerFromMessageComponent({
        id: 'component-1',
        type: 'component',
        data: {
          category: 'Tool',
          tool: 'sandbox_service_start',
        },
      }),
    ).toEqual({
      providerId: RUNTIME_ACTIVITY_SANDBOX_SERVICES_PROVIDER_ID,
      tool: 'sandbox_service_start',
      componentId: 'component-1',
      receivedAt: 1234,
    });
  });

  it('ignores non-sandbox and non-tool message components', () => {
    expect(
      resolveRuntimeActivityTriggerFromMessageComponent({
        id: 'component-1',
        type: 'component',
        data: {
          category: 'Tool',
          tool: 'write_todos',
        },
      }),
    ).toBeNull();

    expect(
      resolveRuntimeActivityTriggerFromMessageComponent({
        id: 'component-2',
        type: 'component',
        data: {
          category: 'Dashboard',
          tool: 'sandbox_service_start',
        },
      }),
    ).toBeNull();
  });

  it('filters the sandbox services panel down to active services', () => {
    expect(
      filterActiveSandboxServices([
        createService('stopped'),
        createService('running', { id: 'running-1' }),
        createService('failed'),
        createService('starting', { id: 'starting-1' }),
        createService('stopping', { id: 'stopping-1' }),
      ]).map((service) => service.id),
    ).toEqual(['running-1', 'starting-1', 'stopping-1']);
  });

  it('chooses adaptive sandbox services polling intervals', () => {
    expect(getSandboxServicesPollingIntervalMs([])).toBeNull();

    expect(
      getSandboxServicesPollingIntervalMs([createService('running')]),
    ).toBe(SANDBOX_SERVICES_RUNNING_POLL_INTERVAL_MS);

    expect(
      getSandboxServicesPollingIntervalMs([
        createService('running'),
        createService('starting'),
      ]),
    ).toBe(SANDBOX_SERVICES_TRANSITION_POLL_INTERVAL_MS);

    expect(hasTransitioningSandboxServices([createService('stopping')])).toBe(
      true,
    );
  });
});
