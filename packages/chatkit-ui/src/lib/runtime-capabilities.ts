import type {
  RuntimeCapabilitiesResponse,
  RuntimeCapabilitiesSelection,
  RuntimeCapabilityPlugin,
  RuntimeCapabilitySkill,
  RuntimeCapabilitySubAgent,
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
    }
  | {
      type: 'subAgent';
      id: string;
      label: string;
      description?: string;
      capability: RuntimeCapabilitySubAgent;
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
    subAgents: {
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
    subAgents: {
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
    subAgents: {
      nodeKeys: uniqueStrings(
        selections.flatMap((selection) => selection?.subAgents?.nodeKeys ?? []),
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
    type === 'skill'
      ? selection.skills.ids
      : type === 'plugin'
        ? selection.plugins.nodeKeys
        : (selection.subAgents?.nodeKeys ?? []);
  const shouldSelect = selected ?? !ids.includes(id);
  const nextIds = shouldSelect
    ? uniqueStrings([...ids, id])
    : ids.filter((item) => item !== id);

  if (type === 'skill') {
    return {
      ...selection,
      skills: {
        ...selection.skills,
        ids: nextIds,
      },
    };
  }

  if (type === 'plugin') {
    return {
      ...selection,
      plugins: {
        nodeKeys: nextIds,
      },
    };
  }

  return {
    ...selection,
    subAgents: {
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
    ...(capabilities.subAgents ?? []).map((capability) => ({
      type: 'subAgent' as const,
      id: capability.nodeKey,
      label: capability.label,
      description: capability.description ?? capability.name,
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
    selection.skills.ids.length > 0 ||
    selection.plugins.nodeKeys.length > 0 ||
    (selection.subAgents?.nodeKeys.length ?? 0) > 0
  );
}

export function isRuntimeCapabilitySelected(
  selection: RuntimeCapabilitiesSelection,
  type: RuntimeCapabilityOption['type'],
  id: string,
): boolean {
  if (type === 'skill') {
    return selection.skills.ids.includes(id);
  }

  if (type === 'plugin') {
    return selection.plugins.nodeKeys.includes(id);
  }

  return selection.subAgents?.nodeKeys.includes(id) ?? false;
}
