import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { Client } from '@xpert-ai/xpert-sdk';
import { describe, expect, it, vi } from 'vitest';
import { useRuntimeCapabilitiesState } from './runtime-capabilities';

type Capabilities = Awaited<
  ReturnType<Client['assistants']['getRuntimeCapabilities']>
>;
const empty: Capabilities = {
  skills: [],
  plugins: [],
  subAgents: [],
  commands: [],
};

function fixture() {
  const client = new Client({ apiUrl: 'https://example.test/api/ai' });
  const read = vi
    .spyOn(client.assistants, 'getRuntimeCapabilities')
    .mockResolvedValue(empty);
  return {
    client,
    read,
    assistantId: 'assistant',
    threadId: null,
    disabled: false,
    projectId: undefined as string | undefined,
    scopeReady: true,
  };
}

describe('runtime capability reads', () => {
  it('waits for the historical project and loads only that scope', async () => {
    const options = fixture();
    const hook = renderHook(useRuntimeCapabilitiesState, {
      initialProps: { ...options, scopeReady: false },
    });
    await act(async () => {});
    expect(options.read).not.toHaveBeenCalled();
    hook.rerender({ ...options, projectId: 'project', scopeReady: true });
    await waitFor(() =>
      expect(hook.result.current.runtimeCapabilitiesReady).toBe(true),
    );
    expect(options.read).toHaveBeenCalledExactlyOnceWith(
      'assistant',
      expect.objectContaining({ projectId: 'project' }),
    );
  });

  it('loads resolved personal scope and survives the StrictMode effect replay with one request', async () => {
    const options = fixture();
    const hook = renderHook(() => useRuntimeCapabilitiesState(options), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <StrictMode>{children}</StrictMode>
      ),
    });
    await waitFor(() =>
      expect(hook.result.current.runtimeCapabilitiesReady).toBe(true),
    );
    expect(options.read).toHaveBeenCalledTimes(1);
    expect(options.read.mock.calls[0][1]).not.toHaveProperty('projectId');
  });

  it('shares pending readers without letting one unmount cancel the other', async () => {
    const options = fixture();
    let resolve!: (value: Capabilities) => void;
    options.read.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const first = renderHook(() => useRuntimeCapabilitiesState(options));
    const second = renderHook(() => useRuntimeCapabilitiesState(options));
    await act(async () => {});
    expect(options.read).toHaveBeenCalledTimes(1);
    const signal = options.read.mock.calls[0][1]?.signal;
    first.unmount();
    expect(signal?.aborted).toBe(false);
    await act(async () => resolve(empty));
    expect(second.result.current.runtimeCapabilitiesReady).toBe(true);
    second.unmount();
    const next = renderHook(() => useRuntimeCapabilitiesState(options));
    await waitFor(() =>
      expect(next.result.current.runtimeCapabilitiesReady).toBe(true),
    );
    expect(options.read).toHaveBeenCalledTimes(2);
  });

  it('ignores a late old-project response, even if the transport ignores abort', async () => {
    const options = fixture();
    let resolveOld!: (value: Capabilities) => void;
    options.read.mockReturnValueOnce(
      new Promise((done) => {
        resolveOld = done;
      }),
    );
    const hook = renderHook(useRuntimeCapabilitiesState, {
      initialProps: options,
    });
    await act(async () => {});
    const oldSignal = options.read.mock.calls[0][1]?.signal;
    hook.rerender({ ...options, projectId: 'new-project' });
    await waitFor(() =>
      expect(hook.result.current.runtimeCapabilitiesReady).toBe(true),
    );
    expect(oldSignal?.aborted).toBe(true);
    await act(async () =>
      resolveOld({
        ...empty,
        plugins: [{ nodeKey: 'old', provider: 'old', label: 'Old' }],
      }),
    );
    expect(hook.result.current.runtimeCapabilities?.plugins).toEqual([]);
    expect(options.read).toHaveBeenCalledTimes(2);
  });

  it('does not share different assistants, projects or authenticated clients', async () => {
    const options = fixture();
    const other = fixture();
    options.read.mockImplementation(() => new Promise(() => {}));
    other.read.mockImplementation(() => new Promise(() => {}));
    const hooks = [
      renderHook(() => useRuntimeCapabilitiesState(options)),
      renderHook(() =>
        useRuntimeCapabilitiesState({ ...options, projectId: 'project' }),
      ),
      renderHook(() =>
        useRuntimeCapabilitiesState({ ...options, assistantId: 'other' }),
      ),
      renderHook(() => useRuntimeCapabilitiesState(other)),
    ];
    await act(async () => {});
    expect(options.read).toHaveBeenCalledTimes(3);
    expect(other.read).toHaveBeenCalledTimes(1);
    hooks.forEach((hook) => hook.unmount());
  });
});
