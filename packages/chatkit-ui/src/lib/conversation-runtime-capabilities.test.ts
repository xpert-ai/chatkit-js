import { describe, expect, it } from 'vitest';
import type {
  RuntimeCapabilitiesResponse,
  RuntimeCapabilitiesSelection,
} from '@xpert-ai/xpert-sdk';

import {
  getRuntimeCapabilitiesSelectionAvailability,
  hasMissingRuntimeCapabilityReferences,
} from './conversation-runtime-capabilities';

describe('conversation runtime capabilities', () => {
  it('keeps available persisted selections and lists unavailable references', () => {
    const capabilities: RuntimeCapabilitiesResponse = {
      skills: [
        {
          id: 'skill-1',
          workspaceId: 'workspace-1',
          label: 'Skill 1',
        },
      ],
      plugins: [
        {
          nodeKey: 'plugin-1',
          provider: 'provider',
          label: 'Plugin 1',
        },
      ],
      subAgents: [
        {
          nodeKey: 'sub-agent-1',
          type: 'agent',
          label: 'Sub-agent 1',
        },
      ],
    };
    const selection: RuntimeCapabilitiesSelection = {
      mode: 'allowlist',
      skills: {
        workspaceId: 'workspace-1',
        ids: ['skill-1', 'missing-skill'],
      },
      plugins: {
        nodeKeys: ['plugin-1', 'missing-plugin'],
      },
      subAgents: {
        nodeKeys: ['sub-agent-1', 'missing-sub-agent'],
      },
    };

    const availability = getRuntimeCapabilitiesSelectionAvailability(
      selection,
      capabilities,
    );

    expect(availability.selection).toEqual({
      mode: 'allowlist',
      skills: {
        workspaceId: 'workspace-1',
        ids: ['skill-1'],
      },
      plugins: {
        nodeKeys: ['plugin-1'],
      },
      subAgents: {
        nodeKeys: ['sub-agent-1'],
      },
    });
    expect(availability.missing).toEqual({
      skillIds: ['missing-skill'],
      pluginNodeKeys: ['missing-plugin'],
      subAgentNodeKeys: ['missing-sub-agent'],
    });
    expect(hasMissingRuntimeCapabilityReferences(availability.missing)).toBe(
      true,
    );
  });
});
