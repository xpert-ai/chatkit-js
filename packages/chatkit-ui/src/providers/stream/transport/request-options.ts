import type {
  ProjectSelection,
  ResumeStreamOptions,
  StreamRunInput,
  StreamSubmitOptions,
} from '../types';

export function withConversationScope(
  input: StreamRunInput | null | undefined,
  projectId?: string,
  connectorBindingIds: readonly string[] = [],
  projectSelection?: ProjectSelection,
): StreamRunInput | null | undefined {
  if (!input || 'action' in input) {
    return input;
  }

  const runtimeCapabilities = input.input.runtimeCapabilities;
  const normalizedConnectorBindingIds = Array.from(
    new Set(
      connectorBindingIds.map((bindingId) => bindingId.trim()).filter(Boolean),
    ),
  );
  const nextRuntimeCapabilities =
    runtimeCapabilities || normalizedConnectorBindingIds.length
      ? {
          ...(runtimeCapabilities ?? {
            mode: 'allowlist' as const,
            inheritUnselected: true,
            skills: { ids: [] },
            plugins: { nodeKeys: [] },
          }),
          ...(normalizedConnectorBindingIds.length
            ? {
                connectors: { bindingIds: normalizedConnectorBindingIds },
              }
            : { connectors: undefined }),
        }
      : undefined;
  return {
    ...input,
    projectId,
    ...(projectSelection ? { projectSelection } : {}),
    input: {
      ...input.input,
      ...(nextRuntimeCapabilities
        ? { runtimeCapabilities: nextRuntimeCapabilities }
        : { runtimeCapabilities: undefined }),
    },
  };
}

export function retainResumeStreamOptions(
  options?: StreamSubmitOptions,
): ResumeStreamOptions {
  return {
    streamMode: options?.streamMode,
    streamSubgraphs: options?.streamSubgraphs,
    streamResumable: options?.streamResumable,
    ...(options?.context ? { context: options.context } : {}),
    ...(options?.config ? { config: options.config } : {}),
  };
}

export function mergeStreamRequestContext(
  base: Record<string, unknown> | undefined,
  additional: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!additional || Object.keys(additional).length === 0) return base;
  const baseEnv = readStringFields(base?.env);
  const additionalEnv = readStringFields(additional.env);
  const merged = { ...(base ?? {}), ...additional };
  const env = { ...baseEnv, ...additionalEnv };
  return Object.keys(env).length > 0 ? { ...merged, env } : merged;
}

export function readStringFields(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, field] of Object.entries(value)) {
    if (typeof field === 'string') result[key] = field;
  }
  return result;
}
