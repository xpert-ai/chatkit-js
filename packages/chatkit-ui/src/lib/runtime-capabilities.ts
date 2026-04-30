import type {
  RuntimeCapabilitiesResponse,
  RuntimeCapabilitiesSelection,
  RuntimeCapabilityPlugin,
  RuntimeCapabilitySkill,
} from '@xpert-ai/chatkit-types';

export type RuntimeCapabilityOption =
  | {
      type: 'skill';
      id: string;
      label: string;
      description?: string;
      capability: RuntimeCapabilitySkill;
    }
  | {
      type: 'plugin';
      id: string;
      label: string;
      description?: string;
      capability: RuntimeCapabilityPlugin;
    };

function toString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeSkill(value: unknown): RuntimeCapabilitySkill | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = toString(record.id);
  const workspaceId = toString(record.workspaceId);
  const label = toString(record.label) || id;
  if (!id || !workspaceId || !label) {
    return null;
  }

  return {
    id,
    workspaceId,
    label,
    ...(toString(record.description)
      ? { description: toString(record.description) }
      : {}),
    ...(toString(record.repositoryName)
      ? { repositoryName: toString(record.repositoryName) }
      : {}),
    ...(toString(record.provider) ? { provider: toString(record.provider) } : {}),
    ...(record.default === true || record.defaultSelected === true
      ? { default: true }
      : {}),
  };
}

function normalizePlugin(value: unknown): RuntimeCapabilityPlugin | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const nodeKey = toString(record.nodeKey);
  const provider = toString(record.provider);
  const label = toString(record.label) || provider || nodeKey;
  if (!nodeKey || !provider || !label) {
    return null;
  }

  return {
    nodeKey,
    provider,
    label,
    ...(toString(record.description)
      ? { description: toString(record.description) }
      : {}),
    ...(Array.isArray(record.toolNames)
      ? { toolNames: uniqueStrings(record.toolNames.filter((item): item is string => typeof item === 'string')) }
      : {}),
  };
}

export function normalizeRuntimeCapabilitiesResponse(
  value: unknown,
): RuntimeCapabilitiesResponse {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    skills: Array.isArray(record.skills)
      ? record.skills
          .map((item) => normalizeSkill(item))
          .filter((item): item is RuntimeCapabilitySkill => item !== null)
      : [],
    plugins: Array.isArray(record.plugins)
      ? record.plugins
          .map((item) => normalizePlugin(item))
          .filter((item): item is RuntimeCapabilityPlugin => item !== null)
      : [],
  };
}

export function createEmptyRuntimeCapabilitiesSelection(
  capabilities?: RuntimeCapabilitiesResponse | null,
): RuntimeCapabilitiesSelection {
  const workspaceId = capabilities?.skills[0]?.workspaceId;
  return {
    mode: 'allowlist',
    skills: {
      ...(workspaceId ? { workspaceId } : {}),
      ids: [],
    },
    plugins: {
      nodeKeys: [],
    },
  };
}

export function createDefaultRuntimeCapabilitiesSelection(
  capabilities?: RuntimeCapabilitiesResponse | null,
): RuntimeCapabilitiesSelection {
  const workspaceId = capabilities?.skills[0]?.workspaceId;
  return {
    mode: 'allowlist',
    skills: {
      ...(workspaceId ? { workspaceId } : {}),
      ids: uniqueStrings(
        (capabilities?.skills ?? [])
          .filter((skill) => skill.default === true)
          .map((skill) => skill.id),
      ),
    },
    plugins: {
      nodeKeys: [],
    },
  };
}

export function mergeRuntimeCapabilitiesSelections(
  capabilities: RuntimeCapabilitiesResponse,
  ...selections: Array<RuntimeCapabilitiesSelection | null | undefined>
): RuntimeCapabilitiesSelection {
  const workspaceId =
    selections.find((selection) => selection?.skills.workspaceId)?.skills
      .workspaceId ?? capabilities.skills[0]?.workspaceId;

  return {
    mode: 'allowlist',
    skills: {
      ...(workspaceId ? { workspaceId } : {}),
      ids: uniqueStrings(
        selections.flatMap((selection) => selection?.skills.ids ?? []),
      ),
    },
    plugins: {
      nodeKeys: uniqueStrings(
        selections.flatMap((selection) => selection?.plugins.nodeKeys ?? []),
      ),
    },
  };
}

export function toggleRuntimeCapabilitySelection(
  selection: RuntimeCapabilitiesSelection,
  type: RuntimeCapabilityOption['type'],
  id: string,
  selected?: boolean,
): RuntimeCapabilitiesSelection {
  const ids =
    type === 'skill' ? selection.skills.ids : selection.plugins.nodeKeys;
  const shouldSelect = selected ?? !ids.includes(id);
  const nextIds = shouldSelect
    ? uniqueStrings([...ids, id])
    : ids.filter((item) => item !== id);

  return type === 'skill'
    ? {
        ...selection,
        skills: {
          ...selection.skills,
          ids: nextIds,
        },
      }
    : {
        ...selection,
        plugins: {
          nodeKeys: nextIds,
        },
      };
}

export function getRuntimeCapabilityOptions(
  capabilities?: RuntimeCapabilitiesResponse | null,
): RuntimeCapabilityOption[] {
  if (!capabilities) {
    return [];
  }

  return [
    ...capabilities.skills.map((capability) => ({
      type: 'skill' as const,
      id: capability.id,
      label: capability.label,
      description: capability.description ?? capability.repositoryName,
      capability,
    })),
    ...capabilities.plugins.map((capability) => ({
      type: 'plugin' as const,
      id: capability.nodeKey,
      label: capability.label,
      description: capability.description ?? capability.provider,
      capability,
    })),
  ];
}

export function hasRuntimeCapabilitySelection(
  selection?: RuntimeCapabilitiesSelection | null,
): boolean {
  return Boolean(
    selection &&
      (selection.skills.ids.length > 0 || selection.plugins.nodeKeys.length > 0),
  );
}

export function isRuntimeCapabilitySelected(
  selection: RuntimeCapabilitiesSelection,
  type: RuntimeCapabilityOption['type'],
  id: string,
): boolean {
  return type === 'skill'
    ? selection.skills.ids.includes(id)
    : selection.plugins.nodeKeys.includes(id);
}
