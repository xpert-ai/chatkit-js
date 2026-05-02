import type {
  SandboxManagedService,
  SandboxManagedServiceStatus,
} from '@xpert-ai/xpert-sdk';

export type { SandboxManagedService } from '@xpert-ai/xpert-sdk';

export const RUNTIME_ACTIVITY_SANDBOX_SERVICES_PROVIDER_ID =
  'sandbox-services' as const;

export const SANDBOX_SERVICE_TOOL_NAMES = [
  'sandbox_service_start',
  'sandbox_service_list',
  'sandbox_service_stop',
] as const;

export const ACTIVE_SANDBOX_SERVICE_STATUSES = [
  'starting',
  'running',
  'stopping',
] as const;

export const SANDBOX_SERVICES_TRANSITION_POLL_INTERVAL_MS = 2000;
export const SANDBOX_SERVICES_RUNNING_POLL_INTERVAL_MS = 20000;

export type RuntimeActivityProviderId =
  typeof RUNTIME_ACTIVITY_SANDBOX_SERVICES_PROVIDER_ID;

export type SandboxServiceToolName = (typeof SANDBOX_SERVICE_TOOL_NAMES)[number];

export type SandboxServicesActivityState = {
  providerId: typeof RUNTIME_ACTIVITY_SANDBOX_SERVICES_PROVIDER_ID;
  services: SandboxManagedService[];
  isRefreshing: boolean;
  refreshedAt: number | null;
  error: unknown | null;
};

export type RuntimeActivitiesState = {
  sandboxServices: SandboxServicesActivityState;
};

export type RuntimeActivityTrigger = {
  providerId: typeof RUNTIME_ACTIVITY_SANDBOX_SERVICES_PROVIDER_ID;
  tool: SandboxServiceToolName;
  componentId: string;
  threadId?: string | null;
  receivedAt: number;
};

export type RuntimeActivityProviderDefinition = {
  id: RuntimeActivityProviderId;
};

export type RuntimeActivityToolTriggerDefinition = {
  providerId: RuntimeActivityProviderId;
  tools: readonly SandboxServiceToolName[];
};

export const RUNTIME_ACTIVITY_PROVIDER_REGISTRY: readonly RuntimeActivityProviderDefinition[] =
  [
    {
      id: RUNTIME_ACTIVITY_SANDBOX_SERVICES_PROVIDER_ID,
    },
  ];

export const RUNTIME_ACTIVITY_TOOL_TRIGGER_REGISTRY: readonly RuntimeActivityToolTriggerDefinition[] =
  [
    {
      providerId: RUNTIME_ACTIVITY_SANDBOX_SERVICES_PROVIDER_ID,
      tools: SANDBOX_SERVICE_TOOL_NAMES,
    },
  ];

type ToolComponentCandidate = {
  id?: unknown;
  type?: unknown;
  data?: unknown;
};

type ToolComponentDataCandidate = {
  category?: unknown;
  tool?: unknown;
};

function isSandboxServiceToolName(value: unknown): value is SandboxServiceToolName {
  return RUNTIME_ACTIVITY_TOOL_TRIGGER_REGISTRY.some((trigger) =>
    trigger.tools.some((tool) => tool === value),
  );
}

function isActiveSandboxServiceStatus(
  status: SandboxManagedServiceStatus,
): boolean {
  return (
    status === 'starting' || status === 'running' || status === 'stopping'
  );
}

export function hasTransitioningSandboxServices(
  services: SandboxManagedService[],
): boolean {
  return services.some(
    (service) => service.status === 'starting' || service.status === 'stopping',
  );
}

export function getSandboxServicesPollingIntervalMs(
  services: SandboxManagedService[],
): number | null {
  if (services.length === 0) {
    return null;
  }

  return hasTransitioningSandboxServices(services)
    ? SANDBOX_SERVICES_TRANSITION_POLL_INTERVAL_MS
    : SANDBOX_SERVICES_RUNNING_POLL_INTERVAL_MS;
}

export function createDefaultRuntimeActivitiesState(): RuntimeActivitiesState {
  return {
    sandboxServices: {
      providerId: RUNTIME_ACTIVITY_SANDBOX_SERVICES_PROVIDER_ID,
      services: [],
      isRefreshing: false,
      refreshedAt: null,
      error: null,
    },
  };
}

export function resolveRuntimeActivityTriggerFromMessageComponent(
  value: unknown,
): RuntimeActivityTrigger | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const component = value as ToolComponentCandidate;
  if (
    component.type !== 'component' ||
    typeof component.id !== 'string' ||
    !component.data ||
    typeof component.data !== 'object' ||
    Array.isArray(component.data)
  ) {
    return null;
  }

  const data = component.data as ToolComponentDataCandidate;
  if (data.category !== 'Tool' || !isSandboxServiceToolName(data.tool)) {
    return null;
  }

  return {
    providerId: RUNTIME_ACTIVITY_SANDBOX_SERVICES_PROVIDER_ID,
    tool: data.tool,
    componentId: component.id,
    receivedAt: Date.now(),
  };
}

export function filterActiveSandboxServices(
  services: SandboxManagedService[],
): SandboxManagedService[] {
  return services
    .filter((service) => isActiveSandboxServiceStatus(service.status))
    .sort((a, b) => {
      const aStartedAt = Date.parse(a.startedAt ?? '');
      const bStartedAt = Date.parse(b.startedAt ?? '');
      const safeA = Number.isNaN(aStartedAt) ? 0 : aStartedAt;
      const safeB = Number.isNaN(bStartedAt) ? 0 : bStartedAt;
      return safeB - safeA;
    });
}
