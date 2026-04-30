import { describe, expect, it } from 'vitest';

import {
  createDefaultRuntimeCapabilitiesSelection,
  normalizeRuntimeCapabilitiesResponse,
} from './runtime-capabilities';

describe('runtime capabilities helpers', () => {
  it('normalizes default skills and uses them as the initial allow-list', () => {
    const capabilities = normalizeRuntimeCapabilitiesResponse({
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
    });

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
