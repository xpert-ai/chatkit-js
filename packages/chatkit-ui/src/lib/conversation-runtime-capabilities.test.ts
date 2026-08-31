import { describe, expect, it, vi } from 'vitest';
import type { Client, RuntimeCapabilitiesResponse } from '@xpert-ai/xpert-sdk';

import {
  createConversationThreadSearchWhere,
  getRuntimeCapabilitiesSelectionAvailability,
  hasMissingRuntimeCapabilityReferences,
  persistConversationRuntimeCapabilities,
} from './conversation-runtime-capabilities';
import type { RuntimeCapabilitiesSelection } from './runtime-capabilities';

describe('conversation runtime capabilities', () => {
  it('scopes direct thread lookup to the Xpert and explicit Project boundary', () => {
    expect(
      createConversationThreadSearchWhere(' thread-1 ', {
        xpertId: ' xpert-1 ',
        projectId: null,
      }),
    ).toEqual({
      threadId: 'thread-1',
      xpertId: 'xpert-1',
      projectId: null,
    });

    expect(
      createConversationThreadSearchWhere('thread-1', {
        xpertId: 'xpert-1',
        projectId: ' project-1 ',
      }),
    ).toEqual({
      threadId: 'thread-1',
      xpertId: 'xpert-1',
      projectId: 'project-1',
    });
  });

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
      inheritUnselected: true,
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
      inheritUnselected: true,
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

  it('persists only the available selection and drops per-run recommendations', async () => {
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
      subAgents: [],
    };
    const search = vi.fn().mockResolvedValue({
      items: [
        {
          id: 'conversation-1',
          threadId: 'thread-1',
          options: {
            parameters: { input: 'seed' },
            runtimeCapabilities: {
              mode: 'allowlist',
              skills: { ids: [] },
              plugins: { nodeKeys: [] },
              connectors: { bindingIds: ['binding-1'] },
            },
          },
        },
      ],
    });
    const update = vi.fn().mockResolvedValue(null);
    const client = {
      conversations: {
        search,
        update,
      },
    } as unknown as Client<unknown>;

    await persistConversationRuntimeCapabilities({
      client,
      threadId: 'thread-1',
      xpertId: 'xpert-1',
      projectId: null,
      capabilities,
      selection: {
        mode: 'allowlist',
        skills: { workspaceId: 'workspace-1', ids: [] },
        plugins: { nodeKeys: ['plugin-1'] },
        subAgents: { nodeKeys: [] },
        recommended: {
          skills: { workspaceId: 'workspace-1', ids: ['skill-1'] },
          plugins: { nodeKeys: [] },
          subAgents: { nodeKeys: [] },
        },
      },
    });

    expect(search).toHaveBeenCalledWith({
      where: {
        threadId: 'thread-1',
        xpertId: 'xpert-1',
        projectId: null,
      },
      limit: 1,
    });

    expect(update).toHaveBeenCalledWith('conversation-1', {
      options: {
        parameters: { input: 'seed' },
        runtimeCapabilities: {
          mode: 'allowlist',
          skills: { workspaceId: 'workspace-1', ids: [] },
          plugins: { nodeKeys: ['plugin-1'] },
          subAgents: { nodeKeys: [] },
          connectors: { bindingIds: ['binding-1'] },
        },
      },
    });
  });
});
