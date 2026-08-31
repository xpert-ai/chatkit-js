import { describe, expect, it } from 'vitest';

import {
  extractMessageReferences,
  extractReferenceComposition,
  extractRuntimeCapabilities,
  extractSubmittedInput,
  isMessageMetadataContainer,
  isRuntimeCapabilitiesSelection,
} from './message-metadata';

describe('message metadata extraction', () => {
  it('narrows unknown payloads before extracting nested human metadata', () => {
    const payload: unknown = {
      state: {
        human: {
          input: 'Explain this file',
          referenceComposition: 'compose',
          references: [
            {
              path: 'src/app.ts',
              startLine: 4,
              endLine: 8,
              text: 'console.log("hello");',
            },
          ],
          runtimeCapabilities: {
            mode: 'allowlist',
            skills: { ids: [] },
            plugins: { nodeKeys: ['middleware-1'] },
            subAgents: { nodeKeys: [] },
          },
        },
      },
    };

    expect(isMessageMetadataContainer(payload)).toBe(true);
    if (!isMessageMetadataContainer(payload)) {
      throw new Error('Expected payload to be a metadata container.');
    }

    expect(extractSubmittedInput(payload)).toBe('Explain this file');
    expect(extractReferenceComposition(payload)).toBe('compose');
    expect(extractMessageReferences(payload)).toEqual([
      expect.objectContaining({
        type: 'code',
        path: 'src/app.ts',
        startLine: 4,
        endLine: 8,
      }),
    ]);
    expect(extractRuntimeCapabilities(payload)).toEqual({
      mode: 'allowlist',
      skills: { ids: [] },
      plugins: { nodeKeys: ['middleware-1'] },
      subAgents: { nodeKeys: [] },
    });
  });

  it('rejects malformed runtime capability selections', () => {
    expect(
      isRuntimeCapabilitiesSelection({
        mode: 'allowlist',
        skills: { ids: [123] },
        plugins: { nodeKeys: ['middleware-1'] },
      }),
    ).toBe(false);

    expect(
      isRuntimeCapabilitiesSelection({
        mode: 'allowlist',
        skills: { ids: ['skill-1'], workspaceId: 'workspace-1' },
        plugins: { nodeKeys: ['middleware-1'] },
        inheritUnselected: true,
      }),
    ).toBe(true);

    expect(
      isRuntimeCapabilitiesSelection({
        mode: 'allowlist',
        skills: { ids: [] },
        plugins: { nodeKeys: [] },
        inheritUnselected: 'yes',
      }),
    ).toBe(false);
  });

  it('accepts runtime capability selections with recommended metadata', () => {
    const runtimeCapabilities = {
      mode: 'allowlist',
      skills: { workspaceId: 'workspace-1', ids: ['skill-available'] },
      plugins: { nodeKeys: [] },
      subAgents: { nodeKeys: [] },
      recommended: {
        skills: { workspaceId: 'workspace-1', ids: ['skill-recommended'] },
        plugins: { nodeKeys: ['middleware-1'] },
        subAgents: { nodeKeys: [] },
      },
    };

    expect(isRuntimeCapabilitiesSelection(runtimeCapabilities)).toBe(true);
    expect(
      extractRuntimeCapabilities({
        runtimeCapabilities,
      }),
    ).toEqual(runtimeCapabilities);
  });
});
