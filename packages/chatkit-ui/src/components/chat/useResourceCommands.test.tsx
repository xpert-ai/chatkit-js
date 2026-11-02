import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Client, type RuntimeResourceCommand } from '@xpert-ai/xpert-sdk';
import { useResourceCommands } from './useResourceCommands';

const command: RuntimeResourceCommand = {
  skill: { bindingId: 'binding', version: 'v1', skillKey: 'bom' },
  packageName: 'operations',
  description: 'BOM',
  command: {},
};
describe('selected plugin command discovery', () => {
  it('reuses unchanged resource versions across renders and remounts, but isolates clients and expiry', async () => {
    const client = new Client<unknown>({
      apiUrl: 'https://example.test/api/ai',
    });
    const other = new Client<unknown>({
      apiUrl: 'https://example.test/api/ai',
    });
    const list = vi
      .spyOn(client.assistants, 'getResourceCommands')
      .mockResolvedValue([command]);
    const otherList = vi
      .spyOn(other.assistants, 'getResourceCommands')
      .mockResolvedValue([]);
    const useCommands = (
      activeClient: Client<unknown>,
      revision: number,
      enabled = true,
    ) =>
      useResourceCommands({
        client: activeClient,
        assistantId: 'assistant',
        enabled,
        selection: { revision, resources: [{ ...command.skill }] },
      });
    const hook = renderHook(
      ({ revision, enabled, activeClient }) =>
        useCommands(activeClient, revision, enabled),
      {
        initialProps: { revision: 1, enabled: true, activeClient: client },
      },
    );
    await waitFor(() =>
      expect(hook.result.current.commands).toEqual([command]),
    );
    hook.rerender({ revision: 2, enabled: true, activeClient: client });
    expect(list).toHaveBeenCalledTimes(1);
    hook.unmount();
    const reopened = renderHook(
      ({ activeClient, enabled }) => useCommands(activeClient, 3, enabled),
      {
        initialProps: { activeClient: client, enabled: true },
      },
    );
    await waitFor(() =>
      expect(reopened.result.current.commands).toEqual([command]),
    );
    expect(list).toHaveBeenCalledTimes(1);
    reopened.rerender({ activeClient: other, enabled: true });
    expect(reopened.result.current.commands).toEqual([]);
    await waitFor(() => expect(otherList).toHaveBeenCalledTimes(1));
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_001);
    try {
      reopened.rerender({ activeClient: client, enabled: true });
      await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    } finally {
      clock.mockRestore();
      reopened.unmount();
    }
  });

  it('uses pinned resources and clears stale results on deselection or scope changes', async () => {
    const client = new Client<unknown>({
      apiUrl: 'https://example.test/api/ai',
    });
    const list = vi
      .spyOn(client.assistants, 'getResourceCommands')
      .mockResolvedValue([command]);
    const selection = { revision: 2, resources: [command.skill] };
    const hook = renderHook(
      ({ projectId, selected }) =>
        useResourceCommands({
          client,
          assistantId: 'assistant',
          projectId,
          enabled: true,
          selection: selected,
        }),
      { initialProps: { projectId: 'project', selected: selection } },
    );
    await waitFor(() => expect(hook.result.current.commands).toHaveLength(1));
    expect(list).toHaveBeenCalledWith(
      'assistant',
      selection,
      expect.objectContaining({ projectId: 'project' }),
    );
    let finish!: (commands: RuntimeResourceCommand[]) => void;
    list.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    hook.rerender({ projectId: 'other-project', selected: selection });
    expect(hook.result.current.commands).toEqual([]);
    hook.rerender({
      projectId: 'other-project',
      selected: { revision: 3, resources: [] },
    });
    await act(async () => finish([command]));
    expect(hook.result.current.commands).toEqual([]);
  });
  it('does not load commands for unavailable selection state', () => {
    const client = new Client<unknown>({
      apiUrl: 'https://example.test/api/ai',
    });
    const list = vi.spyOn(client.assistants, 'getResourceCommands');
    renderHook(() =>
      useResourceCommands({
        client,
        assistantId: 'assistant',
        enabled: false,
        selection: { revision: 0, resources: [command.skill] },
      }),
    );
    expect(list).not.toHaveBeenCalled();
  });
});
