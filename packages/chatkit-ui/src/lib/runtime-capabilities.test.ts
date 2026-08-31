import { describe, expect, it } from 'vitest';
import type { RuntimeCapabilitiesResponse } from '@xpert-ai/xpert-sdk';

import {
  createRuntimeCapabilitiesForSubmit,
  createDefaultRuntimeCapabilitiesSelection,
  createEmptyRuntimeCapabilitiesSelection,
  getAvailableRuntimeCapabilitiesSelection,
  getRecommendedRuntimeCapabilitiesSelection,
  getRuntimeSkillSource,
  mergeRuntimeCapabilitiesSelections,
  toggleRuntimeCapabilitySelection,
  type RuntimeCapabilitiesSelection,
} from './runtime-capabilities';

describe('runtime capabilities helpers', () => {
  it('reads only structurally valid skill source metadata', () => {
    expect(
      getRuntimeSkillSource({
        id: 'runtime-skill/v1/project/project-1/xlsx',
        workspaceId: 'project:project-1',
        label: 'xlsx',
        meta: {
          skillSource: {
            type: 'project',
            ownerId: 'project-1',
            label: 'Workbench 1',
            skillId: 'xlsx',
          },
        },
      }),
    ).toEqual({
      type: 'project',
      ownerId: 'project-1',
      label: 'Workbench 1',
      skillId: 'xlsx',
    });
    expect(
      getRuntimeSkillSource({
        id: 'invalid',
        workspaceId: 'workspace-1',
        label: 'invalid',
        meta: { skillSource: { type: 'project', label: 'Missing fields' } },
      }),
    ).toBeNull();
  });

  it('uses default skills as the initial allow-list', () => {
    const capabilities: RuntimeCapabilitiesResponse = {
      skills: [
        {
          id: 'skill-default',
          workspaceId: 'workspace-1',
          label: 'Default Skill',
          default: true,
        },
        {
          id: 'skill-optional',
          workspaceId: 'workspace-1',
          label: 'Optional Skill',
        },
      ],
      plugins: [],
      subAgents: [
        {
          nodeKey: 'researcher',
          type: 'agent',
          label: 'Researcher',
        },
      ],
    };

    expect(capabilities.skills[0]?.default).toBe(true);
    expect(createDefaultRuntimeCapabilitiesSelection(capabilities)).toEqual({
      mode: 'allowlist',
      skills: {
        workspaceId: 'workspace-1',
        ids: ['skill-default'],
      },
      plugins: {
        nodeKeys: [],
      },
      subAgents: {
        nodeKeys: [],
      },
    });
  });

  it('normalizes empty selections with sub-agents for older responses', () => {
    const capabilities: RuntimeCapabilitiesResponse = {
      skills: [],
      plugins: [],
    };

    expect(createEmptyRuntimeCapabilitiesSelection(capabilities)).toEqual({
      mode: 'allowlist',
      skills: { ids: [] },
      plugins: { nodeKeys: [] },
      subAgents: { nodeKeys: [] },
    });
  });

  it('merges and toggles sub-agent selections', () => {
    const capabilities = {
      skills: [],
      plugins: [],
      subAgents: [
        {
          nodeKey: 'researcher',
          type: 'agent' as const,
          label: 'Researcher',
        },
      ],
    };

    const selection = toggleRuntimeCapabilitySelection(
      createEmptyRuntimeCapabilitiesSelection(capabilities),
      'subAgent',
      'researcher',
      true,
    );

    expect(selection.subAgents?.nodeKeys).toEqual(['researcher']);
    expect(
      mergeRuntimeCapabilitiesSelections(
        capabilities,
        selection,
        createEmptyRuntimeCapabilitiesSelection(capabilities),
      ).subAgents?.nodeKeys,
    ).toEqual(['researcher']);
  });

  it('preserves inherited capabilities through normalization and submit merging', () => {
    const capabilities: RuntimeCapabilitiesResponse = {
      skills: [],
      plugins: [],
      subAgents: [],
    };
    const inherited: RuntimeCapabilitiesSelection = {
      mode: 'allowlist',
      inheritUnselected: true,
      skills: { ids: [] },
      plugins: { nodeKeys: [] },
      subAgents: { nodeKeys: [] },
      connectors: { bindingIds: ['binding-1'] },
    };

    expect(getAvailableRuntimeCapabilitiesSelection(inherited)).toEqual(
      inherited,
    );
    expect(mergeRuntimeCapabilitiesSelections(capabilities, inherited)).toEqual(
      inherited,
    );
    expect(
      createRuntimeCapabilitiesForSubmit({
        capabilities,
        available: inherited,
      }),
    ).toEqual(inherited);
  });

  it('submits available capabilities with slash selections marked as recommended', () => {
    const capabilities: RuntimeCapabilitiesResponse = {
      skills: [
        {
          id: 'skill-review',
          workspaceId: 'workspace-1',
          label: 'Review',
        },
      ],
      plugins: [
        {
          nodeKey: 'middleware-search',
          provider: 'search',
          label: 'Search',
        },
      ],
      subAgents: [],
    };

    const selection = createRuntimeCapabilitiesForSubmit({
      capabilities,
      available: {
        mode: 'allowlist',
        skills: { workspaceId: 'workspace-1', ids: [] },
        plugins: { nodeKeys: ['middleware-search'] },
        subAgents: { nodeKeys: [] },
      },
      recommended: {
        mode: 'allowlist',
        skills: { workspaceId: 'workspace-1', ids: ['skill-review'] },
        plugins: { nodeKeys: [] },
        subAgents: { nodeKeys: [] },
      },
    });

    expect(selection).toEqual({
      mode: 'allowlist',
      skills: { workspaceId: 'workspace-1', ids: ['skill-review'] },
      plugins: { nodeKeys: ['middleware-search'] },
      subAgents: { nodeKeys: [] },
      recommended: {
        skills: { workspaceId: 'workspace-1', ids: ['skill-review'] },
        plugins: { nodeKeys: [] },
        subAgents: { nodeKeys: [] },
      },
    });
    expect(getRecommendedRuntimeCapabilitiesSelection(selection)).toEqual({
      mode: 'allowlist',
      skills: { workspaceId: 'workspace-1', ids: ['skill-review'] },
      plugins: { nodeKeys: [] },
      subAgents: { nodeKeys: [] },
    });
  });
});
