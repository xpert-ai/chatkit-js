import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Client, type GroupArtifactView } from '@xpert-ai/xpert-sdk';
import { useGroupResourceNavigation } from './useGroupResourceNavigation';

const host = vi.hoisted(() => ({ openPresentation: vi.fn() }));
vi.mock('../../../workbench/context', () => ({ useWorkbench: () => host }));
vi.mock('../../../workbench/WorkbenchRuntime', () => ({
  useWorkbenchRuntime: () => ({ projectId: 'B', runtimeScopeReady: true }),
}));
afterEach(() => vi.clearAllMocks());
const reference = {
  id: 'ref',
  groupId: 'g',
  runtimeProjectId: 'B',
  ownerProjectId: 'A',
  title: 'Inventory',
  artifactId: 'artifact',
  versionId: 'v',
  grantId: 'grant',
  revision: 1,
  versionNumber: 1,
  expiresAt: '2099-01-01T00:00:00Z',
  readOnly: true as const,
  url: '',
};
const view: GroupArtifactView = {
  reference,
  title: 'Inventory',
  revision: 1,
  content: {
    kind: 'presentation',
    presentation: {
      schemaVersion: 1,
      target: { artifactId: 'artifact', versionId: 'v' },
      title: 'Inventory',
      versionNumber: 1,
      readOnly: true,
      entry: { html: '' },
      data: {},
      operations: [],
    },
  },
};
const request = {
  referenceId: 'ref',
  projectId: 'B',
  title: 'Inventory',
  requestId: 'request',
  clientMessageId: 'sent',
};
it('opens a group reference with the generic source, consumes once and does not switch to the authoring Project', async () => {
  const client = new Client();
  const read = vi
    .spyOn(client.groups.artifacts, 'read')
    .mockResolvedValue(view);
  const consume = vi.fn(),
    onError = vi.fn();
  const { rerender, unmount } = renderHook(() =>
    useGroupResourceNavigation({
      client,
      groupId: 'g',
      request,
      consume,
      onError,
    }),
  );
  await waitFor(() => expect(host.openPresentation).toHaveBeenCalledTimes(1));
  rerender();
  expect(consume).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledWith('g', 'ref', expect.any(Object));
  expect(host.openPresentation.mock.calls[0][0]).toMatchObject({
    key: 'chatkit.preview.presentation:["g","ref"]',
    kind: 'presentation',
  });
  expect(onError).not.toHaveBeenCalled();
  unmount();
});
it('rejects revoked references and discards delayed responses after unmount', async () => {
  const client = new Client(),
    onError = vi.fn();
  const read = vi
    .spyOn(client.groups.artifacts, 'read')
    .mockRejectedValue(new Error('revoked'));
  const hook = renderHook(() =>
    useGroupResourceNavigation({ client, groupId: 'g', onError }),
  );
  await act(async () => hook.result.current(request));
  expect(onError).toHaveBeenCalledTimes(1);
  expect(host.openPresentation).not.toHaveBeenCalled();
  let resolve!: (value: GroupArtifactView) => void;
  read.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  let pending!: Promise<void>;
  act(() => {
    pending = hook.result.current(request);
  });
  hook.unmount();
  await act(async () => {
    resolve(view);
    await pending;
  });
  expect(host.openPresentation).not.toHaveBeenCalled();
});
