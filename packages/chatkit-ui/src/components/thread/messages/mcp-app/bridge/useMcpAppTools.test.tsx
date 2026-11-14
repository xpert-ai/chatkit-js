import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MCP_APP_TOOL_CALL, MCP_APP_TOOLS_LIST } from '@xpert-ai/chatkit-types';
import { resolveAppClientTool } from './app-tools';
import { useMcpAppTools } from './useMcpAppTools';

async function setup() {
  const client = {};
  let declared = { tools: [{ name: 'edit', inputSchema: { type: 'object' } }] };
  const called = vi.fn();
  const authorize = vi.fn(async () => undefined);
  const callHost = vi.fn(async () => ({ result: {} }));
  const post = vi.fn((message: unknown) => {
    if (
      !message ||
      typeof message !== 'object' ||
      !('method' in message) ||
      !('id' in message)
    )
      return;
    if (message.method === 'tools/call') called(message);
    queueMicrotask(() =>
      hook.result.current({
        jsonrpc: '2.0',
        id: message.id,
        result:
          message.method === 'tools/list'
            ? declared
            : { content: [{ type: 'text', text: 'done' }] },
      }),
    );
  });
  const options = {
    client,
    threadId: 'chat',
    appInstanceId: 'app',
    resourceEpoch: 1,
    isCurrent: () => true,
    post,
    authorize,
    callHost,
  };
  const hook = renderHook((props) => useMcpAppTools(props), {
    initialProps: options,
  });
  act(() => {
    hook.result.current({
      method: 'ui/initialize',
      params: { appCapabilities: { tools: { listChanged: true } } },
    });
  });
  const listed = await resolveAppClientTool(client, 'chat', {
    name: MCP_APP_TOOLS_LIST,
    args: {},
  });
  const viewId: string = JSON.parse(listed!.content).views[0].viewId;
  const invoke = (name = 'edit') =>
    resolveAppClientTool(client, 'chat', {
      name: MCP_APP_TOOL_CALL,
      id: crypto.randomUUID(),
      args: { viewId, name, arguments: {} },
    });
  return {
    hook,
    client,
    options,
    invoke,
    called,
    post,
    authorize,
    callHost,
    changeTools: () => {
      declared = { tools: [] };
    },
  };
}

describe('MCP App view lifecycle', () => {
  it('requires negotiated tools and exact declarations before host approval', async () => {
    const view = await setup();
    expect((await view.invoke('undeclared'))?.status).toBe('error');
    expect(view.authorize).not.toHaveBeenCalled();
    expect((await view.invoke())?.status).toBe('success');
    expect(view.authorize).toHaveBeenCalledOnce();
    expect(view.called).toHaveBeenCalledOnce();
    view.hook.unmount();
  });

  it('never invokes an App after rejection or declaration changes during approval', async () => {
    const view = await setup();
    view.authorize.mockRejectedValueOnce(new Error('Rejected'));
    expect((await view.invoke())?.status).toBe('error');
    view.authorize.mockImplementationOnce(async () => {
      view.changeTools();
    });
    expect((await view.invoke())?.status).toBe('error');
    expect(view.called).not.toHaveBeenCalled();
    view.hook.unmount();
  });

  it('invalidates a pending confirmation on list_changed even when schemas are identical', async () => {
    const view = await setup();
    view.authorize.mockImplementationOnce(async () => {
      view.hook.result.current({ method: 'notifications/tools/list_changed' });
    });
    expect((await view.invoke())?.status).toBe('error');
    expect(view.called).not.toHaveBeenCalled();
    view.hook.unmount();
  });

  it('rechecks current instance authorization before returning results', async () => {
    const view = await setup();
    view.authorize.mockImplementationOnce(async () => {
      view.callHost.mockRejectedValueOnce(new Error('Access revoked'));
    });
    expect((await view.invoke())?.status).toBe('error');
    expect(view.called).not.toHaveBeenCalled();
    view.hook.unmount();
  });

  it('closes handles on teardown and resource replacement', async () => {
    const view = await setup();
    act(() => {
      view.hook.rerender({ ...view.options, resourceEpoch: 2 });
    });
    expect((await view.invoke())?.status).toBe('error');
    act(() => {
      view.hook.result.current({
        method: 'ui/initialize',
        params: { appCapabilities: {} },
      });
    });
    const listed = await resolveAppClientTool(view.client, 'chat', {
      name: MCP_APP_TOOLS_LIST,
      args: {},
    });
    expect(JSON.parse(listed!.content)).toEqual({ views: [] });
    view.hook.unmount();
  });
});
