import { MCP_APP_TOOL_AUTHORIZE } from '@xpert-ai/chatkit-types';
import * as React from 'react';
import type { McpAppJsonRpcRequest } from '../host';
import { isMcpAppRpcSuccess } from '../host';
import { AppToolRpc, parseAppTools, registerAppToolView } from './app-tools';

type Options = {
  client: object;
  threadId: string | null | undefined;
  appInstanceId: string;
  resourceEpoch: number;
  isCurrent: () => boolean;
  element?: () => HTMLIFrameElement | null;
  post: (message: unknown) => void;
  callHost: (request: McpAppJsonRpcRequest) => Promise<unknown>;
  authorize: (
    request: McpAppJsonRpcRequest,
    signal: AbortSignal,
  ) => Promise<void>;
};

/** Called only after the bridge has authenticated the iframe sender and origin. */
export function useMcpAppTools(options: Options) {
  const latest = React.useRef(options);
  latest.current = options;
  const session = React.useRef<{
    rpc: AppToolRpc;
    abort: AbortController;
    dispose?: () => void;
    revision: number;
    listChanged: boolean;
  } | null>(null);

  const close = React.useCallback(() => {
    const active = session.current;
    session.current = null;
    active?.dispose?.();
    active?.abort.abort();
    active?.rpc.close();
  }, []);
  React.useEffect(
    () => close,
    [
      options.client,
      options.threadId,
      options.appInstanceId,
      options.resourceEpoch,
      close,
    ],
  );

  return React.useCallback(
    (value: unknown) => {
      const current = latest.current;
      if (!current.isCurrent()) {
        close();
        return false;
      }
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch {
          return false;
        }
      }
      if (session.current?.rpc.receive(value)) return true;
      if (!value || typeof value !== 'object' || !('method' in value))
        return false;
      if (value.method === 'ui/notifications/request-teardown') {
        close();
        return false;
      }
      if (value.method === 'notifications/tools/list_changed') {
        if (session.current?.listChanged) session.current.revision++;
        return true;
      }
      if (value.method !== 'ui/initialize') return false;
      close();
      if (
        !current.threadId ||
        !('params' in value) ||
        !value.params ||
        typeof value.params !== 'object' ||
        !('appCapabilities' in value.params)
      )
        return false;
      const capabilities = value.params.appCapabilities;
      if (
        !capabilities ||
        typeof capabilities !== 'object' ||
        !('tools' in capabilities) ||
        !capabilities.tools ||
        typeof capabilities.tools !== 'object'
      )
        return false;
      const abort = new AbortController();
      const epoch = current.resourceEpoch;
      const isCurrent = () =>
        !abort.signal.aborted &&
        latest.current.resourceEpoch === epoch &&
        latest.current.isCurrent();
      const rpc = new AppToolRpc(
        (message) => latest.current.post(message),
        isCurrent,
      );
      const active = {
        rpc,
        abort,
        revision: 0,
        listChanged:
          'listChanged' in capabilities.tools &&
          capabilities.tools.listChanged === true,
        dispose: undefined as (() => void) | undefined,
      };
      session.current = active;
      const assertAccess = async () => {
        const response = await latest.current.callHost({
          id: crypto.randomUUID(),
          method: 'ping',
        });
        if (!isCurrent() || !isMcpAppRpcSuccess(response))
          throw new Error('MCP App access is no longer available');
      };
      active.dispose = registerAppToolView(current.client, {
        appInstanceId: current.appInstanceId,
        threadId: current.threadId,
        order: () => {
          const element = latest.current.element?.();
          return element
            ? Array.from(
                element.ownerDocument.querySelectorAll('iframe'),
              ).indexOf(element)
            : 0;
        },
        isCurrent,
        list: async () => {
          await assertAccess();
          return rpc.request('tools/list');
        },
        call: async (input) => {
          await assertAccess();
          const revision = active.revision;
          const tools = parseAppTools(await rpc.request('tools/list'));
          const tool = tools.tools.find((entry) => entry.name === input.name);
          if (!tool)
            throw new Error('MCP App tool is not declared by this view');
          await latest.current.authorize(
            { method: MCP_APP_TOOL_AUTHORIZE, params: input },
            abort.signal,
          );
          if (!isCurrent() || revision !== active.revision)
            throw new Error('MCP App tools changed during approval');
          const updated = parseAppTools(
            await rpc.request('tools/list'),
          ).tools.find((entry) => entry.name === input.name);
          if (JSON.stringify(tool) !== JSON.stringify(updated))
            throw new Error('MCP App tool definition changed');
          await assertAccess();
          const result = await rpc.request('tools/call', {
            name: input.name,
            arguments: input.arguments,
          });
          await assertAccess();
          return result;
        },
      }).dispose;
      return false;
    },
    [close],
  );
}
