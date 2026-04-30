import type {
  RuntimeCapabilitiesResponse,
  RuntimeCapabilitiesSelection,
  RuntimeCapabilityPlugin,
  RuntimeCapabilitySkill,
} from '@xpert-ai/xpert-sdk';

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

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
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
  if (!selection) {
    return false;
  }

  return (
    selection.skills.ids.length > 0 || selection.plugins.nodeKeys.length > 0
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
