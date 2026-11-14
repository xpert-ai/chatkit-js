import { afterEach, describe, expect, it, vi } from 'vitest';
import { MCP_APP_TOOL_CALL, MCP_APP_TOOLS_LIST } from '@xpert-ai/chatkit-types';
import {
  AppToolRpc,
  parseAppTools,
  registerAppToolView,
  resolveAppClientTool,
} from './app-tools';

const tools = { tools: [{ name: 'edit', inputSchema: { type: 'object' } }] };
afterEach(() => vi.useRealTimers());

describe('live App tool views', () => {
  it('routes identical tool names to the exact view and isolates Clients and chats', async () => {
    const client = {};
    const a = vi.fn(async () => ({ content: [{ type: 'text', text: 'A' }] }));
    const b = vi.fn(async () => ({ content: [{ type: 'text', text: 'B' }] }));
    const first = registerAppToolView(client, {
      appInstanceId: 'same-app',
      threadId: 'chat',
      isCurrent: () => true,
      list: async () => tools,
      call: a,
    });
    const second = registerAppToolView(client, {
      appInstanceId: 'same-app',
      threadId: 'chat',
      isCurrent: () => true,
      list: async () => tools,
      call: b,
    });
    const call = {
      id: 'call',
      name: MCP_APP_TOOL_CALL,
      args: { viewId: second.viewId, name: 'edit', arguments: {} },
    };
    expect((await resolveAppClientTool(client, 'chat', call))?.status).toBe(
      'success',
    );
    expect((await resolveAppClientTool(client, 'chat', call))?.status).toBe(
      'error',
    );
    expect(b).toHaveBeenCalledOnce();
    expect(a).not.toHaveBeenCalled();
    expect((await resolveAppClientTool({}, 'chat', call))?.status).toBe(
      'error',
    );
    expect(
      (await resolveAppClientTool(client, 'other-chat', call))?.status,
    ).toBe('error');
    second.dispose();
    expect((await resolveAppClientTool(client, 'chat', call))?.status).toBe(
      'error',
    );
    first.dispose();
  });

  it('lists views in current page order even when initialization finishes out of order', async () => {
    const client = {};
    let firstOrder = 1;
    const late = registerAppToolView(client, {
      appInstanceId: 'later',
      threadId: 'chat',
      isCurrent: () => true,
      list: async () => tools,
      call: async () => ({}),
      order: () => firstOrder,
    });
    const early = registerAppToolView(client, {
      appInstanceId: 'earlier',
      threadId: 'chat',
      isCurrent: () => true,
      list: async () => tools,
      call: async () => ({}),
      order: () => 0,
    });
    const list = async () =>
      JSON.parse(
        (await resolveAppClientTool(client, 'chat', {
          name: MCP_APP_TOOLS_LIST,
          args: {},
        }))!.content,
      ).views;
    expect(
      (await list()).map((view: { viewId: string }) => view.viewId),
    ).toEqual([early.viewId, late.viewId]);
    firstOrder = -1;
    expect((await list())[0].viewId).toBe(late.viewId);
    late.dispose();
    early.dispose();
  });

  it('discovers current declarations and fails closed after a view epoch changes', async () => {
    const client = {};
    let current = true;
    let declared = tools;
    registerAppToolView(client, {
      appInstanceId: 'app',
      threadId: 'chat',
      isCurrent: () => current,
      list: async () => declared,
      call: async () => ({}),
    });
    const call = { name: MCP_APP_TOOLS_LIST, args: {} };
    expect(
      (await resolveAppClientTool(client, 'chat', call))?.content,
    ).toContain('edit');
    declared = { tools: [] };
    expect(
      (await resolveAppClientTool(client, 'chat', call))?.content,
    ).not.toContain('edit');
    current = false;
    expect(
      JSON.parse((await resolveAppClientTool(client, 'chat', call))!.content),
    ).toEqual({ views: [] });
  });

  it('rejects duplicate declarations, oversized metadata, malformed calls and oversized results', async () => {
    expect(() =>
      parseAppTools({ tools: [...tools.tools, ...tools.tools] }),
    ).toThrow();
    expect(() =>
      parseAppTools({
        tools: [{ ...tools.tools[0], description: 'x'.repeat(4097) }],
      }),
    ).toThrow();
    expect(() =>
      parseAppTools({ tools: [], padding: 'x'.repeat(300_000) }),
    ).toThrow();
    expect(
      (
        await resolveAppClientTool({}, 'chat', {
          name: MCP_APP_TOOL_CALL,
          args: { viewId: 'view' },
        })
      )?.status,
    ).toBe('error');
    expect(
      await resolveAppClientTool({}, 'chat', { name: 'unrelated', args: {} }),
    ).toBeNull();
  });
});

describe('reverse JSON-RPC', () => {
  it('matches only its pending response, including string envelopes', async () => {
    const post = vi.fn();
    const rpc = new AppToolRpc(post, () => true);
    const response = rpc.request('tools/list');
    const id = post.mock.calls[0][0].id;
    expect(
      rpc.receive({ jsonrpc: '2.0', id: 'another-view', result: tools }),
    ).toBe(false);
    expect(rpc.receive({ jsonrpc: '2.0', id, method: 'tools/list' })).toBe(
      false,
    );
    expect(
      rpc.receive(JSON.stringify({ jsonrpc: '2.0', id, result: tools })),
    ).toBe(true);
    expect(await response).toEqual(tools);
    rpc.close();
  });

  it('cancels pending calls on close and never accepts a late result', async () => {
    const post = vi.fn();
    const rpc = new AppToolRpc(post, () => true);
    const response = rpc.request('tools/call', { name: 'edit', arguments: {} });
    const rejected = expect(response).rejects.toThrow('outcome may be unknown');
    const id = post.mock.calls[0][0].id;
    rpc.close();
    await rejected;
    expect(post.mock.calls[1][0]).toMatchObject({
      method: 'notifications/cancelled',
      params: { requestId: id },
    });
    expect(rpc.receive({ jsonrpc: '2.0', id, result: {} })).toBe(false);
    await expect(rpc.request('tools/list')).rejects.toThrow('closed');
  });

  it('bounds request time and rejects stale epochs and oversized responses', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const post = vi.fn();
    let current = true;
    const rpc = new AppToolRpc(post, () => current);
    const pending = rpc.request('tools/list');
    const expired = expect(pending).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(30_000);
    await expired;
    const stale = rpc.request('tools/list');
    const rejected = expect(stale).rejects.toThrow('closed');
    current = false;
    rpc.receive({
      jsonrpc: '2.0',
      id: post.mock.calls.at(-1)![0].id,
      result: {},
    });
    await rejected;
    current = true;
    const oversized = rpc.request('tools/list');
    const bounded = expect(oversized).rejects.toThrow('limit');
    rpc.receive({
      jsonrpc: '2.0',
      id: post.mock.calls.at(-1)![0].id,
      result: 'x'.repeat(300_000),
    });
    await bounded;
    rpc.close();
  });
});
