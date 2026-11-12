import { expect, it, vi } from 'vitest';
import { Client, type GroupArtifactView } from '@xpert-ai/xpert-sdk';
import { resolveWorkbenchResource } from './resolve-resource';

const id = '91237858-9d1c-4ddc-940f-cbc1c52c317f';
function fixture() {
  const client = new Client({ apiUrl: 'https://example.test/api/ai' });
  const view: GroupArtifactView = {
    reference: {
      id,
      groupId: 'group',
      runtimeProjectId: 'usage',
      ownerProjectId: 'source',
      artifactId: 'artifact',
      versionId: 'fixed',
      grantId: 'grant',
      title: 'Shared dashboard',
      versionNumber: 1,
      revision: 1,
      readOnly: true,
      expiresAt: '2026-12-01T00:00:00Z',
      url: 'https://example.test/resource',
    },
    title: 'Shared dashboard',
    revision: 1,
    content: {
      kind: 'presentation',
      presentation: {
        schemaVersion: 1,
        title: 'Shared dashboard',
        target: { artifactId: 'artifact', versionId: 'fixed' },
        versionNumber: 1,
        readOnly: true,
        entry: { html: '<html><body>Shared dashboard</body></html>' },
        data: { meta: {} },
        operations: ['query'],
        expiresAt: '2026-12-01T00:00:00Z',
      },
    },
  };
  vi.spyOn(client.groups.artifacts, 'read').mockResolvedValue(view);
  vi.spyOn(client.content, 'resolve').mockResolvedValue({
    viewKey: 'plugin.editor',
    selectionId: 'artifact',
  });
  return {
    client,
    view,
    assistantId: 'assistant',
    projectId: 'usage',
    groupId: 'group',
    isCurrent: () => true,
  };
}

it('opens shared content through a group-authorized presentation tab, never the source Project', async () => {
  const host = fixture();
  const result = await resolveWorkbenchResource(
    { kind: 'group-reference', id },
    host,
  );
  expect(host.client.groups.artifacts.read).toHaveBeenCalledWith('group', id, {
    signal: undefined,
  });
  expect(host.client.content.resolve).not.toHaveBeenCalled();
  expect(result).toMatchObject({
    kind: 'presentation',
    preview: {
      kind: 'presentation',
      title: 'Shared dashboard',
      key: `chatkit.preview.presentation:["group","${id}"]`,
    },
  });
});

it('resolves owned resources through the current Assistant and Project catalog', async () => {
  const host = fixture();
  expect(
    await resolveWorkbenchResource({ kind: 'project-content', id }, host),
  ).toMatchObject({
    kind: 'content',
    navigation: { viewKey: 'plugin.editor', selectionId: 'artifact' },
  });
  expect(host.client.content.resolve).toHaveBeenCalledWith(
    { assistantId: 'assistant', projectId: 'usage' },
    { providerKey: 'platform.content.catalog', resourceId: id },
    { signal: undefined },
  );
  expect(host.client.groups.artifacts.read).not.toHaveBeenCalled();
});

it('rejects caller-selected scope, foreign references, revocation and stale responses', async () => {
  const host = fixture();
  await expect(
    resolveWorkbenchResource(
      { kind: 'group-reference', id, groupId: 'other' },
      host,
    ),
  ).rejects.toThrow();
  expect(host.client.groups.artifacts.read).not.toHaveBeenCalled();
  host.view.reference.groupId = 'other';
  await expect(
    resolveWorkbenchResource({ kind: 'group-reference', id }, host),
  ).rejects.toThrow('changed');
  host.view.reference.groupId = 'group';
  vi.mocked(host.client.groups.artifacts.read).mockImplementation(async () => {
    host.isCurrent = () => false;
    return host.view;
  });
  await expect(
    resolveWorkbenchResource({ kind: 'group-reference', id }, host),
  ).rejects.toThrow('context changed');
  host.isCurrent = () => true;
  vi.mocked(host.client.groups.artifacts.read).mockRejectedValue(
    new Error('revoked'),
  );
  await expect(
    resolveWorkbenchResource({ kind: 'group-reference', id }, host),
  ).rejects.toThrow('revoked');
});

it.each(['group-reference', 'project-content'] as const)(
  'discards canceled %s resolutions before any navigation',
  async (kind) => {
    const host = fixture(),
      controller = new AbortController();
    vi.mocked(host.client.groups.artifacts.read).mockImplementation(
      async () => {
        controller.abort();
        return host.view;
      },
    );
    vi.mocked(host.client.content.resolve).mockImplementation(async () => {
      controller.abort();
      return { viewKey: 'plugin.editor' };
    });
    await expect(
      resolveWorkbenchResource(
        { kind, id },
        { ...host, signal: controller.signal },
      ),
    ).rejects.toThrow('context changed');
    expect(
      kind === 'group-reference'
        ? host.client.groups.artifacts.read
        : host.client.content.resolve,
    ).toHaveBeenCalledTimes(1);
    await expect(
      resolveWorkbenchResource(
        { kind, id },
        { ...host, signal: controller.signal },
      ),
    ).rejects.toThrow('context changed');
    expect(
      kind === 'group-reference'
        ? host.client.groups.artifacts.read
        : host.client.content.resolve,
    ).toHaveBeenCalledTimes(1);
  },
);
