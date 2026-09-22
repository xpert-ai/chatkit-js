import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  Client,
  type RuntimeResourceCatalogItem,
  type RuntimeResourceKind,
  type RuntimeResourceReference,
} from '@xpert-ai/xpert-sdk';
import { useRuntimeResourceCatalog } from './useRuntimeResourceCatalog';
const resource = (
  kind: RuntimeResourceKind,
  index = 0,
): RuntimeResourceCatalogItem => ({
  bindingId: `${kind}-${index}`,
  version: 'v1',
  kind,
  title: `${kind} ${index}`,
  status: 'ready',
  components: [],
  diagnostics: [],
});
function setup() {
  const client = new Client<unknown>({ apiUrl: 'https://example.test/api/ai' });
  const fetch = vi
    .spyOn(client.assistants, 'getResources')
    .mockImplementation(async (_id, options) => ({
      items: [resource(options?.kind ?? 'agent_plugin')],
      total: 1,
    }));
  const hook = renderHook(
    ({
      kind,
      query,
      projectId,
    }: {
      kind: RuntimeResourceKind;
      query: string;
      projectId?: string;
    }) =>
      useRuntimeResourceCatalog({
        client,
        assistantId: 'assistant',
        projectId,
        enabled: true,
        query,
        kind,
      }),
    {
      initialProps: {
        kind: 'agent_plugin' as RuntimeResourceKind,
        query: '',
        projectId: 'one',
      },
    },
  );
  return { ...hook, fetch };
}
describe('resource catalog cache', () => {
  function selectionSetup(selected = resource('middleware')) {
    const client = new Client<unknown>({
      apiUrl: 'https://example.test/api/ai',
    });
    const fetch = vi
      .spyOn(client.assistants, 'getResources')
      .mockResolvedValue({ items: [selected], total: 1 });
    const validate = vi
      .spyOn(client.assistants, 'validateResources')
      .mockImplementation(async (_id, value) => value);
    const hook = renderHook(
      ({ projectId }: { projectId: string }) =>
        useRuntimeResourceCatalog({
          client,
          assistantId: 'assistant',
          enabled: true,
          query: '',
          selectedResources: [selected],
          projectId,
        }),
      { initialProps: { projectId: 'one' } },
    );
    return { ...hook, fetch, validate, selected };
  }

  it('clears ready metadata on refresh and marks a revoked selection unavailable while keeping its label', async () => {
    const { result, fetch, validate, selected } = selectionSetup();
    await waitFor(() =>
      expect(result.current.selectedItems[0].status).toBe('ready'),
    );
    fetch.mockResolvedValue({ items: [], total: 0 });
    validate.mockRejectedValue(
      Object.assign(new Error('revoked'), { status: 403 }),
    );
    act(() => result.current.refresh());
    expect(result.current.known.size).toBe(0);
    expect(result.current.selectedItems[0].status).toBe('checking');
    await waitFor(() =>
      expect(result.current.selectedItems[0].status).toBe('unavailable'),
    );
    expect(result.current.selectedItems[0]).toMatchObject({
      title: selected.title,
      kind: 'middleware',
      version: 'v1',
    });
  });

  it('checks pinned older versions without borrowing newer components or upgrading the selection', async () => {
    const { result, fetch, validate, selected } = selectionSetup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    fetch.mockResolvedValue({
      items: [
        {
          ...selected,
          version: 'v2',
          components: [{ key: 'new-tool', kind: 'mcp', status: 'ready' }],
        },
      ],
      total: 1,
    });
    act(() => result.current.refresh());
    await waitFor(() =>
      expect(result.current.selectedItems[0].status).toBe('previous_version'),
    );
    expect(validate).toHaveBeenCalledWith(
      'assistant',
      {
        revision: 0,
        resources: [
          { bindingId: selected.bindingId, version: selected.version },
        ],
      },
      'one',
    );
    expect(result.current.selectedItems[0].version).toBe('v1');
    expect(result.current.selectedItems[0].components).toEqual([]);
  });

  it('loads every unfiltered page before deciding a selected resource is missing', async () => {
    const { result, fetch, validate, selected } = selectionSetup(
      resource('external_xpert', 101),
    );
    fetch.mockImplementation(async (_id, options) => ({
      items: options?.offset
        ? [selected]
        : Array.from({ length: 100 }, (_, index) =>
            resource('agent_plugin', index),
          ),
      total: 101,
    }));
    expect(result.current.selectedItems[0].status).toBe('checking');
    await waitFor(() =>
      expect(result.current.selectedItems[0].status).toBe('ready'),
    );
    expect(result.current.selectedItems[0].kind).toBe('external_xpert');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(validate).not.toHaveBeenCalled();
  });

  it('reports network failures as unverified and allows retry without calling them revoked', async () => {
    const { result, fetch, validate } = selectionSetup();
    fetch.mockResolvedValue({ items: [], total: 0 });
    validate.mockRejectedValueOnce(new Error('offline'));
    await waitFor(() =>
      expect(result.current.selectedItems[0].status).toBe('unverified'),
    );
    act(() => result.current.refresh());
    await waitFor(() =>
      expect(result.current.selectedItems[0].status).toBe('previous_version'),
    );
    expect(validate).toHaveBeenCalledTimes(2);
  });

  it('does not use another project or a late validation result as proof of availability', async () => {
    const { result, fetch, validate, rerender } = selectionSetup();
    fetch.mockResolvedValue({ items: [], total: 0 });
    let finish!: (value: { revision: number; resources: [] }) => void;
    validate.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await waitFor(() => expect(validate).toHaveBeenCalledTimes(1));
    validate.mockRejectedValue(
      Object.assign(new Error('not available'), { status: 403 }),
    );
    rerender({ projectId: 'two' });
    await waitFor(() =>
      expect(result.current.selectedItems[0].status).toBe('unavailable'),
    );
    await act(async () => finish({ revision: 0, resources: [] }));
    expect(result.current.selectedItems[0].status).toBe('unavailable');
  });

  it('rechecks availability when returning from workspace management', async () => {
    const { result, fetch, validate } = selectionSetup();
    await waitFor(() =>
      expect(result.current.selectedItems[0].status).toBe('ready'),
    );
    fetch.mockResolvedValue({ items: [], total: 0 });
    validate.mockRejectedValue(
      Object.assign(new Error('disabled'), { status: 403 }),
    );
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() =>
      expect(result.current.selectedItems[0].status).toBe('unavailable'),
    );
  });

  it('does not reuse a stale search result as proof that the selected version is current', async () => {
    const selected = resource('agent_plugin');
    const client = new Client<unknown>({
      apiUrl: 'https://example.test/api/ai',
    });
    vi.spyOn(client.assistants, 'getResources').mockImplementation(
      async (_id, options) => ({
        items: [{ ...selected, version: options?.kind ? 'v1' : 'v2' }],
        total: 1,
      }),
    );
    vi.spyOn(client.assistants, 'validateResources').mockRejectedValue(
      Object.assign(new Error('old version disabled'), { status: 403 }),
    );
    const { result, rerender } = renderHook(
      ({
        selectedResources,
      }: {
        selectedResources: RuntimeResourceReference[];
      }) =>
        useRuntimeResourceCatalog({
          client,
          assistantId: 'assistant',
          enabled: true,
          query: '',
          kind: 'agent_plugin',
          selectedResources,
        }),
      { initialProps: { selectedResources: [] as RuntimeResourceReference[] } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items[0].version).toBe('v1');
    rerender({ selectedResources: [selected] });
    await waitFor(() =>
      expect(result.current.selectedItems[0].status).toBe('unavailable'),
    );
    expect(result.current.selectedItems[0].version).toBe('v1');
  });

  it('ignores a validation response from before an explicit refresh', async () => {
    const { result, fetch, validate } = selectionSetup();
    fetch.mockResolvedValue({ items: [], total: 0 });
    let finish!: (value: { revision: number; resources: [] }) => void;
    validate.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await waitFor(() => expect(validate).toHaveBeenCalledTimes(1));
    validate.mockRejectedValue(
      Object.assign(new Error('revoked'), { status: 403 }),
    );
    act(() => result.current.refresh());
    await waitFor(() =>
      expect(result.current.selectedItems[0].status).toBe('unavailable'),
    );
    await act(async () => finish({ revision: 0, resources: [] }));
    expect(result.current.selectedItems[0].status).toBe('unavailable');
  });

  it('keeps catalog failures distinct from revocation and recovers on refresh', async () => {
    const { result, fetch, selected, validate } = selectionSetup();
    fetch.mockRejectedValueOnce(new Error('catalog offline'));
    await waitFor(() =>
      expect(result.current.selectedItems[0].status).toBe('unverified'),
    );
    expect(result.current.loadError).toBe('catalog offline');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(validate).not.toHaveBeenCalled();
    fetch.mockResolvedValue({ items: [selected], total: 1 });
    act(() => result.current.refresh());
    await waitFor(() =>
      expect(result.current.selectedItems[0].status).toBe('ready'),
    );
    expect(result.current.loadError).toBeNull();
  });

  it('searches localized descriptions in cached resources without fetching again', async () => {
    const { result, rerender, fetch } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    fetch.mockResolvedValueOnce({
      items: [
        {
          ...resource('middleware'),
          description: { en_US: 'Canvas helper', zh_Hans: '画布助手' },
        },
      ],
      total: 1,
    });
    rerender({ kind: 'middleware', query: '画布', projectId: 'one' });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    rerender({ kind: 'middleware', query: 'Canvas', projectId: 'one' });
    expect(result.current.items).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('reuses each category when switching, searches direct resources locally and refreshes explicitly', async () => {
    const { result, rerender, fetch } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    for (const kind of ['middleware', 'external_xpert'] as const) {
      rerender({ kind, query: '', projectId: 'one' });
      await waitFor(() => expect(result.current.loading).toBe(false));
    }
    expect(fetch).toHaveBeenCalledTimes(3);
    rerender({ kind: 'middleware', query: 'missing', projectId: 'one' });
    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
    rerender({ kind: 'agent_plugin', query: '', projectId: 'one' });
    expect(result.current.items[0].kind).toBe('agent_plugin');
    expect(fetch).toHaveBeenCalledTimes(3);
    act(() => result.current.refresh());
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
  });
  it('fetches every page of middleware once, without a user pagination action', async () => {
    const { result, rerender, fetch } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    fetch.mockImplementation(async (_id, options) => ({
      items: Array.from({ length: options?.offset ? 1 : 100 }, (_, index) =>
        resource('middleware', (options?.offset ?? 0) + index),
      ),
      total: 101,
    }));
    rerender({ kind: 'middleware', query: '', projectId: 'one' });
    await waitFor(() => expect(result.current.items).toHaveLength(101));
    expect(result.current.loading).toBe(false);
    expect(fetch).toHaveBeenLastCalledWith(
      'assistant',
      expect.objectContaining({ kind: 'middleware', offset: 100, limit: 100 }),
    );
    rerender({ kind: 'middleware', query: '100', projectId: 'one' });
    expect(result.current.items).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it('isolates project caches and never displays metadata from the previous project', async () => {
    const { result, rerender, fetch } = setup();
    await waitFor(() => expect(result.current.known.size).toBe(1));
    rerender({ kind: 'agent_plugin', query: '', projectId: 'two' });
    expect(result.current.known.size).toBe(0);
    expect(result.current.items).toEqual([]);
    await waitFor(() =>
      expect(fetch).toHaveBeenLastCalledWith(
        'assistant',
        expect.objectContaining({ projectId: 'two' }),
      ),
    );
  });
});
