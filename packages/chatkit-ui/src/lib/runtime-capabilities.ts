import type {
  RuntimeCapabilitiesResponse,
  RuntimeCapabilitiesSelection as XpertRuntimeCapabilitiesSelection,
  RuntimeCapabilityPlugin,
  RuntimeCapabilitySkill,
  RuntimeCapabilitySubAgent,
} from '@xpert-ai/xpert-sdk';

export type RuntimeSkillSource =
  | {
      type: 'xpert';
      ownerId: string;
      label: string;
      skillId: string;
    }
  | {
      type: 'project';
      ownerId: string;
      label: string;
      skillId: string;
    };

function isRuntimeSkillSource(value: unknown): value is RuntimeSkillSource {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  if (
    !('type' in value) ||
    (value.type !== 'xpert' && value.type !== 'project') ||
    !('ownerId' in value) ||
    typeof value.ownerId !== 'string' ||
    !('label' in value) ||
    typeof value.label !== 'string' ||
    !('skillId' in value) ||
    typeof value.skillId !== 'string'
  ) {
    return false;
  }
  return true;
}

export function getRuntimeSkillSource(
  skill: RuntimeCapabilitySkill,
): RuntimeSkillSource | null {
  const source = skill.meta?.skillSource;
  return isRuntimeSkillSource(source) ? source : null;
}

export type RuntimeCapabilitiesSelectionSet = {
  skills: {
    workspaceId?: string;
    ids: string[];
  };
  plugins: {
    nodeKeys: string[];
  };
  subAgents?: {
    nodeKeys: string[];
  };
  connectors?: {
    bindingIds: string[];
  };
};

export type RuntimeCapabilitiesSelection = XpertRuntimeCapabilitiesSelection & {
  inheritUnselected?: boolean;
  recommended?: RuntimeCapabilitiesSelectionSet;
};

export type RuntimeCapabilityOption =
  | {
      type: 'skill';
      id: string;
      label: string;
      description?: string;
      color?: string;
      capability: RuntimeCapabilitySkill;
    }
  | {
      type: 'plugin';
      id: string;
      label: string;
      description?: string;
      color?: string;
      capability: RuntimeCapabilityPlugin;
    }
  | {
      type: 'subAgent';
      id: string;
      label: string;
      description?: string;
      color?: string;
      capability: RuntimeCapabilitySubAgent;
    };

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function getRuntimeCapabilitiesSelectionSet(
  selection?: RuntimeCapabilitiesSelectionSet | null,
): RuntimeCapabilitiesSelectionSet {
  const connectorBindingIds = uniqueStrings(
    selection?.connectors?.bindingIds ?? [],
  );
  return {
    skills: {
      ...(selection?.skills.workspaceId
        ? { workspaceId: selection.skills.workspaceId }
        : {}),
      ids: uniqueStrings(selection?.skills.ids ?? []),
    },
    plugins: {
      nodeKeys: uniqueStrings(selection?.plugins.nodeKeys ?? []),
    },
    subAgents: {
      nodeKeys: uniqueStrings(selection?.subAgents?.nodeKeys ?? []),
    },
    ...(connectorBindingIds.length
      ? { connectors: { bindingIds: connectorBindingIds } }
      : {}),
  };
}

function mergeRuntimeCapabilitiesSelectionSets(
  capabilities: RuntimeCapabilitiesResponse,
  ...sets: Array<RuntimeCapabilitiesSelectionSet | null | undefined>
): RuntimeCapabilitiesSelectionSet {
  const workspaceId =
    sets.find((set) => set?.skills.workspaceId)?.skills.workspaceId ??
    capabilities.skills[0]?.workspaceId;

  const connectorBindingIds = uniqueStrings(
    sets.flatMap((set) => set?.connectors?.bindingIds ?? []),
  );
  return {
    skills: {
      ...(workspaceId ? { workspaceId } : {}),
      ids: uniqueStrings(sets.flatMap((set) => set?.skills.ids ?? [])),
    },
    plugins: {
      nodeKeys: uniqueStrings(
        sets.flatMap((set) => set?.plugins.nodeKeys ?? []),
      ),
    },
    subAgents: {
      nodeKeys: uniqueStrings(
        sets.flatMap((set) => set?.subAgents?.nodeKeys ?? []),
      ),
    },
    ...(connectorBindingIds.length
      ? { connectors: { bindingIds: connectorBindingIds } }
      : {}),
  };
}

function shouldInheritUnselectedCapabilities(
  ...selections: Array<RuntimeCapabilitiesSelection | null | undefined>
) {
  return selections.some((selection) => selection?.inheritUnselected === true);
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
  const merged = mergeRuntimeCapabilitiesSelectionSets(
    capabilities,
    ...selections.map((selection) =>
      selection ? getRuntimeCapabilitiesSelectionSet(selection) : null,
    ),
  );
  const recommended = mergeRuntimeCapabilitiesSelectionSets(
    capabilities,
    ...selections.map((selection) => selection?.recommended),
  );

  return {
    mode: 'allowlist',
    ...(shouldInheritUnselectedCapabilities(...selections)
      ? { inheritUnselected: true }
      : {}),
    ...merged,
    ...(hasRuntimeCapabilitySelectionSet(recommended) ? { recommended } : {}),
  };
}

export function createRuntimeCapabilitiesForSubmit({
  capabilities,
  available,
  recommended,
}: {
  capabilities: RuntimeCapabilitiesResponse;
  available?: RuntimeCapabilitiesSelection | null;
  recommended?: RuntimeCapabilitiesSelection | null;
}): RuntimeCapabilitiesSelection {
  const recommendedSet = mergeRuntimeCapabilitiesSelectionSets(
    capabilities,
    recommended,
    recommended?.recommended,
  );
  const merged = mergeRuntimeCapabilitiesSelectionSets(
    capabilities,
    available,
    recommendedSet,
  );

  return {
    mode: 'allowlist',
    ...(shouldInheritUnselectedCapabilities(available, recommended)
      ? { inheritUnselected: true }
      : {}),
    ...merged,
    ...(hasRuntimeCapabilitySelectionSet(recommendedSet)
      ? { recommended: recommendedSet }
      : {}),
  };
}

export function getRecommendedRuntimeCapabilitiesSelection(
  selection?: RuntimeCapabilitiesSelection | null,
): RuntimeCapabilitiesSelection | null {
  if (!selection?.recommended) {
    return null;
  }

  return {
    mode: 'allowlist',
    ...getRuntimeCapabilitiesSelectionSet(selection.recommended),
  };
}

export function getAvailableRuntimeCapabilitiesSelection(
  selection: RuntimeCapabilitiesSelection,
): RuntimeCapabilitiesSelection {
  return {
    mode: 'allowlist',
    ...(selection.inheritUnselected ? { inheritUnselected: true } : {}),
    ...getRuntimeCapabilitiesSelectionSet(selection),
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
      color: readRuntimeCapabilityColor(capability),
      capability,
    })),
    ...capabilities.plugins.map((capability) => ({
      type: 'plugin' as const,
      id: capability.nodeKey,
      label: capability.label,
      description: capability.description ?? capability.provider,
      color: readRuntimeCapabilityColor(capability),
      capability,
    })),
    ...(capabilities.subAgents ?? []).map((capability) => ({
      type: 'subAgent' as const,
      id: capability.nodeKey,
      label: capability.label,
      description: capability.description ?? capability.name,
      color: readRuntimeCapabilityColor(capability),
      capability,
    })),
  ];
}

export function getRuntimeCapabilityColor(
  option?: RuntimeCapabilityOption | null,
): string | undefined {
  return option?.color ?? readRuntimeCapabilityColor(option?.capability);
}

function readRuntimeCapabilityColor(capability: unknown): string | undefined {
  const meta = readObjectValue(capability)?.meta;
  const color = readNonEmptyString(readObjectValue(meta)?.color);
  if (color) {
    return color;
  }
  return readNonEmptyString(readObjectValue(meta)?.brandColor);
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readObjectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
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
    (selection.subAgents?.nodeKeys.length ?? 0) > 0 ||
    (selection.connectors?.bindingIds.length ?? 0) > 0
  );
}

export function hasRuntimeCapabilitySelectionSet(
  selection?: RuntimeCapabilitiesSelectionSet | null,
): boolean {
  if (!selection) {
    return false;
  }

  return (
    selection.skills.ids.length > 0 ||
    selection.plugins.nodeKeys.length > 0 ||
    (selection.subAgents?.nodeKeys.length ?? 0) > 0 ||
    (selection.connectors?.bindingIds.length ?? 0) > 0
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
