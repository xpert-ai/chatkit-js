import { describe, expect, it } from 'vitest';
import { parseComposerInsert, composerInsertPayload } from './composer-insert';
const catalog = {
  skills: [
    { id: 'skill-1', workspaceId: 'workspace-1', label: 'live-dashboard' },
  ],
  plugins: [],
};
describe('editable composer handoff', () => {
  it('resolves a skill from the active catalog and preserves file names and append semantics', () => {
    const input = parseComposerInsert({
      text: 'Build this example',
      skillNames: ['live-dashboard'],
      workspaceFiles: [
        {
          path: '/workspace/demo/hotel.json',
          name: '酒店预订.json',
          mimeType: 'application/json',
          size: 30,
        },
      ],
    });
    expect(composerInsertPayload(input, catalog)).toMatchObject({
      appendText: true,
      workspaceFiles: input.workspaceFiles,
      insertRuntimeCapabilities: true,
      runtimeCapabilities: {
        skills: { ids: ['skill-1'] },
        inheritUnselected: true,
      },
    });
  });
  it('does not silently omit missing or ambiguous skills', () => {
    const input = parseComposerInsert({
      text: 'Example',
      skillNames: ['live-dashboard'],
    });
    expect(() =>
      composerInsertPayload(input, { skills: [], plugins: [] }),
    ).toThrow('SKILL_UNAVAILABLE');
    expect(() =>
      composerInsertPayload(input, {
        ...catalog,
        skills: [...catalog.skills, ...catalog.skills],
      }),
    ).toThrow('SKILL_UNAVAILABLE');
  });
  it.each([
    '/etc/passwords',
    '/workspace/../private',
    '/workspace/x\\y',
    '/workspace/x\u0000',
  ])('rejects an invalid workspace path %s', (path) => {
    expect(() =>
      parseComposerInsert({
        text: 'Example',
        workspaceFiles: [{ path, name: 'data.json' }],
      }),
    ).toThrow('INVALID_FILE');
  });
});
