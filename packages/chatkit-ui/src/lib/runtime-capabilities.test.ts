import { describe, expect, it } from 'vitest';
import type { RuntimeCapabilitiesResponse } from '@xpert-ai/xpert-sdk';

import {
  createDefaultRuntimeCapabilitiesSelection,
  createEmptyRuntimeCapabilitiesSelection,
  mergeRuntimeCapabilitiesSelections,
  toggleRuntimeCapabilitySelection,
} from './runtime-capabilities';

describe('runtime capabilities helpers', () => {
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
});
