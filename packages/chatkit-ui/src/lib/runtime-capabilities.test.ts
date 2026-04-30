import { describe, expect, it } from 'vitest';
import type { RuntimeCapabilitiesResponse } from '@xpert-ai/xpert-sdk';

import { createDefaultRuntimeCapabilitiesSelection } from './runtime-capabilities';

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
    });
  });
});
