import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { Client, type ChatGroupResourceOpenRequest } from '@xpert-ai/xpert-sdk';
import { useGroupResourceNavigation } from './useGroupResourceNavigation';

const host = vi.hoisted(() => ({
  openResource: vi.fn(),
  runtime: { projectId: 'B', runtimeScopeReady: true },
}));
vi.mock('../../../workbench/context', () => ({ useWorkbench: () => host }));
vi.mock('../../../workbench/WorkbenchRuntime', () => ({
  useWorkbenchRuntime: () => host.runtime,
}));
beforeEach(() => {
  vi.resetAllMocks();
  host.runtime = { projectId: 'B', runtimeScopeReady: true };
  host.openResource.mockResolvedValue({ success: true });
});
const request: ChatGroupResourceOpenRequest = {
  resource: { kind: 'group-reference', id: 'ref' },
  projectId: 'B',
  title: 'Inventory',
  requestId: 'request',
  clientMessageId: 'sent',
};
it.each(['group-reference', 'project-content'] as const)(
  'uses the same Workbench entry for %s and consumes live requests once',
  async (kind) => {
    const client = new Client(),
      consume = vi.fn(),
      onError = vi.fn();
    const input = { ...request, resource: { kind, id: 'resource' } };
    const read = vi.spyOn(client.groups.artifacts, 'read');
    const { rerender } = renderHook(() =>
      useGroupResourceNavigation({
        client,
        groupId: 'g',
        request: input,
        consume,
        onError,
      }),
    );
    await waitFor(() => expect(host.openResource).toHaveBeenCalledTimes(1));
    expect(host.openResource).toHaveBeenCalledWith(input.resource, {
      signal: expect.any(AbortSignal),
    });
    rerender();
    expect(consume).toHaveBeenCalledTimes(1);
    expect(host.openResource).toHaveBeenCalledTimes(1);
    expect(read).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  },
);
it('keeps history inert and ignores a link for a different usage Project', async () => {
  const client = new Client(),
    onError = vi.fn();
  const hook = renderHook(() =>
    useGroupResourceNavigation({ client, groupId: 'g', onError }),
  );
  expect(host.openResource).not.toHaveBeenCalled();
  await act(() =>
    hook.result.current({ ...request, projectId: 'source-project' }),
  );
  expect(host.openResource).not.toHaveBeenCalled();
  await act(() => hook.result.current(request));
  expect(host.openResource).toHaveBeenCalledTimes(1);
});
it('waits for host readiness before consuming an automatic open', async () => {
  const client = new Client(),
    consume = vi.fn();
  host.runtime.runtimeScopeReady = false;
  const hook = renderHook(() =>
    useGroupResourceNavigation({
      client,
      groupId: 'g',
      request,
      consume,
      onError: vi.fn(),
    }),
  );
  expect(consume).not.toHaveBeenCalled();
  host.runtime.runtimeScopeReady = true;
  hook.rerender();
  await waitFor(() => expect(host.openResource).toHaveBeenCalledTimes(1));
  expect(consume).toHaveBeenCalledTimes(1);
});
it('reports host authorization errors and cancels outstanding opens on group change or unmount', async () => {
  const client = new Client(),
    onError = vi.fn();
  const hook = renderHook(
    ({ groupId }) => useGroupResourceNavigation({ client, groupId, onError }),
    { initialProps: { groupId: 'g' } },
  );
  host.openResource.mockResolvedValueOnce({
    success: false,
    code: 'resource_unavailable',
  });
  await act(() => hook.result.current(request));
  expect(onError).toHaveBeenCalledTimes(1);
  let resolve!: (value: { success: boolean }) => void;
  host.openResource.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  let pending!: Promise<void>;
  act(() => {
    pending = hook.result.current(request);
  });
  const firstSignal = host.openResource.mock.calls.at(-1)?.[1].signal;
  hook.rerender({ groupId: 'other' });
  expect(firstSignal.aborted).toBe(true);
  await act(async () => {
    resolve({ success: false });
    await pending;
  });
  expect(onError).toHaveBeenCalledTimes(1);
  act(() => {
    pending = hook.result.current(request);
  });
  const secondSignal = host.openResource.mock.calls.at(-1)?.[1].signal;
  hook.unmount();
  expect(secondSignal.aborted).toBe(true);
  await act(async () => {
    resolve({ success: false });
    await pending;
  });
  expect(onError).toHaveBeenCalledTimes(1);
});
