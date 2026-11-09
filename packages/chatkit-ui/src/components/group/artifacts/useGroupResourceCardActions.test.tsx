import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Client,
  type GroupArtifactView,
  type GroupArtifactReference,
} from '@xpert-ai/xpert-sdk';
import { createResourceCardContent } from '@xpert-ai/chatkit-types';
import { useGroupResourceCardActions } from './useGroupResourceCardActions';

const host = vi.hoisted(() => ({ openPresentation: vi.fn() }));
vi.mock('../../../workbench/context', () => ({ useWorkbench: () => host }));
afterEach(() => vi.clearAllMocks());
const card = createResourceCardContent({
  title: 'Inventory',
  resource: {
    namespace: 'test',
    type: 'report',
    id: 'source',
    artifactId: 'artifact',
  },
  open: {
    target: 'assistant.project',
    projectId: 'source-project',
    viewKey: 'authoring',
    parameters: { mode: 'draft' },
  },
});
const reference: GroupArtifactReference = {
  id: 'ref',
  groupId: 'group',
  artifactId: 'artifact',
  versionId: 'v1',
  grantId: 'grant',
  ownerProjectId: 'source-project',
  runtimeProjectId: 'group-project',
  title: 'Authorized inventory',
  versionNumber: 1,
  revision: 1,
  readOnly: true,
  expiresAt: '2099-01-01T00:00:00Z',
  url: '',
};
const view: GroupArtifactView = {
  reference,
  title: reference.title,
  revision: 1,
  content: {
    kind: 'presentation',
    presentation: {
      schemaVersion: 1,
      target: { artifactId: 'artifact', versionId: 'v1' },
      title: reference.title,
      versionNumber: 1,
      readOnly: true,
      entry: { html: '' },
      data: {},
      operations: [],
    },
  },
};
function fixture() {
  const client = new Client();
  const list = vi
    .spyOn(client.groups.artifacts, 'list')
    .mockResolvedValue({ items: [reference], nextOffset: null });
  const read = vi
    .spyOn(client.groups.artifacts, 'read')
    .mockResolvedValue(view);
  const hook = renderHook(
    ({ groupId }) => useGroupResourceCardActions(client, groupId),
    { initialProps: { groupId: 'group' } },
  );
  return { client, list, read, hook };
}

describe('group snapshot resource navigation', () => {
  it('resolves only after a click, pages authorized references, and opens the fixed group version instead of source navigation', async () => {
    const { hook, list, read } = fixture();
    expect(list).not.toHaveBeenCalled();
    list.mockResolvedValueOnce({ items: [], nextOffset: 100 });
    await act(async () => {
      expect(await hook.result.current!(card, 'public-message')).toEqual({
        success: true,
        status: 'opened',
      });
    });
    expect(list).toHaveBeenNthCalledWith(
      2,
      'group',
      { offset: 100, limit: 100 },
      expect.any(Object),
    );
    expect(read).toHaveBeenCalledWith('group', 'ref', expect.any(Object));
    expect(host.openPresentation).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'presentation',
        key: 'chatkit.preview.presentation:["group","ref"]',
        title: 'Authorized inventory',
      }),
    );
    const source = host.openPresentation.mock.calls[0][0].source;
    await source.read(new AbortController().signal);
    expect(read).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(host.openPresentation.mock.calls)).not.toMatch(
      /source-project|authoring|draft/,
    );
  });

  it.each([
    'missing',
    'foreign',
    'ambiguous',
    'revoked',
    'changed-version',
    'changed-project',
  ] as const)(
    'fails closed for %s grants without falling back to the source view',
    async (reason) => {
      const { hook, list, read } = fixture();
      if (reason === 'missing')
        list.mockResolvedValue({ items: [], nextOffset: null });
      if (reason === 'foreign')
        list.mockResolvedValue({
          items: [{ ...reference, groupId: 'other-group' }],
          nextOffset: null,
        });
      if (reason === 'ambiguous')
        list.mockResolvedValue({
          items: [reference, { ...reference, id: 'ref2', versionId: 'v2' }],
          nextOffset: null,
        });
      if (reason === 'revoked') read.mockRejectedValue(new Error('HTTP 403'));
      if (reason === 'changed-version')
        read.mockResolvedValue({
          ...view,
          reference: { ...reference, versionId: 'v2' },
        });
      if (reason === 'changed-project')
        read.mockResolvedValue({
          ...view,
          reference: { ...reference, runtimeProjectId: 'other-project' },
        });
      await act(async () => {
        expect(await hook.result.current!(card, 'public')).toMatchObject({
          success: false,
          message: expect.any(String),
        });
      });
      expect(host.openPresentation).not.toHaveBeenCalled();
    },
  );

  it('does not infer an Artifact identity from a title or the source resource ID', async () => {
    const { hook, list } = fixture();
    const { artifactId: _artifactId, ...resource } = card.data.resource;
    await act(async () => {
      expect(
        await hook.result.current!(
          { ...card, data: { ...card.data, resource } },
          'message',
        ),
      ).toMatchObject({ success: false });
    });
    expect(list).not.toHaveBeenCalled();
  });

  it('reauthorizes on each click, including after successful navigation', async () => {
    const { hook, list } = fixture();
    await act(async () => {
      await hook.result.current!(card, 'message');
    });
    list.mockResolvedValue({ items: [], nextOffset: null });
    await act(async () => {
      expect(await hook.result.current!(card, 'message')).toMatchObject({
        success: false,
      });
    });
    expect(list).toHaveBeenCalledTimes(2);
    expect(host.openPresentation).toHaveBeenCalledTimes(1);
  });

  it.each(['unmount', 'switch'] as const)(
    'discards a delayed read after %s',
    async (change) => {
      const { hook, read } = fixture();
      let resolve!: (value: GroupArtifactView) => void;
      read.mockImplementation(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
      let pending!: ReturnType<NonNullable<typeof hook.result.current>>;
      await act(async () => {
        pending = hook.result.current!(card, 'message');
      });
      if (change === 'unmount') hook.unmount();
      else hook.rerender({ groupId: 'other-group' });
      await act(async () => {
        resolve(view);
        await pending;
      });
      expect(host.openPresentation).not.toHaveBeenCalled();
      expect(read.mock.calls[0][2]?.signal?.aborted).toBe(true);
    },
  );
});
