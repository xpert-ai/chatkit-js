// Invariants: handles belong to one Client/chat/view epoch. No latest-view fallback.
// App metadata and responses are untrusted; approval never grants server resource access.
import {
  MCP_APP_TOOL_CALL,
  MCP_APP_TOOLS_LIST,
  type McpAppToolInvocation,
} from '@xpert-ai/chatkit-types';
import { z } from 'zod';

const toolSchema = z
  .object({
    name: z.string().min(1).max(128),
    description: z.string().max(4096).optional(),
    title: z.string().max(256).optional(),
    inputSchema: z.object({ type: z.literal('object') }).passthrough(),
  })
  .strip();
const listSchema = z.object({ tools: z.array(toolSchema).max(64) });
const invocationSchema = z
  .object({
    viewId: z.string().min(1).max(128),
    name: z.string().min(1).max(128),
    arguments: z.record(z.string(), z.unknown()),
  })
  .strict();

type View = {
  appInstanceId: string;
  threadId: string;
  isCurrent: () => boolean;
  order?: () => number;
  list: () => Promise<unknown>;
  call: (input: McpAppToolInvocation) => Promise<unknown>;
};
const clients = new WeakMap<object, Map<string, View>>();
// Keep bounded dispatch markers for the whole view epoch; never retry a mutation after reconnect.
const dispatched = new WeakMap<View, Set<string>>();

export function boundedAppValue(value: unknown, limit = 256 * 1024) {
  const text = JSON.stringify(value);
  if (text === undefined || new TextEncoder().encode(text).byteLength > limit)
    throw new Error('MCP App response exceeds the host limit');
  return JSON.parse(text) as unknown;
}

export function parseAppTools(value: unknown) {
  const result = listSchema.parse(boundedAppValue(value));
  if (
    new Set(result.tools.map((tool) => tool.name)).size !== result.tools.length
  )
    throw new Error('MCP App declared duplicate tool names');
  return result;
}

export function registerAppToolView(client: object, view: View) {
  const views = clients.get(client) ?? new Map<string, View>();
  for (const [id, entry] of views) if (!entry.isCurrent()) views.delete(id);
  if (views.size >= 16) throw new Error('Too many active MCP App views');
  const viewId = crypto.randomUUID();
  views.set(viewId, view);
  clients.set(client, views);
  return { viewId, dispose: () => views.delete(viewId) };
}

export async function resolveAppClientTool(
  client: object | null | undefined,
  threadId: string | null | undefined,
  call: { name: string; id?: string; args: unknown },
) {
  if (call.name !== MCP_APP_TOOLS_LIST && call.name !== MCP_APP_TOOL_CALL)
    return null;
  try {
    if (!client || !threadId)
      throw new Error('MCP App tools require an active chat');
    const views = clients.get(client);
    let result: unknown;
    if (call.name === MCP_APP_TOOLS_LIST) {
      const entries = [...(views ?? [])]
        .filter(([, view]) => view.threadId === threadId && view.isCurrent())
        .sort(
          ([, left], [, right]) =>
            (left.order?.() ?? 0) - (right.order?.() ?? 0),
        );
      result = {
        views: await Promise.all(
          entries.map(async ([viewId, view]) => {
            try {
              const declared = parseAppTools(await view.list());
              if (!view.isCurrent()) throw new Error('MCP App view closed');
              return { viewId, appInstanceId: view.appInstanceId, ...declared };
            } catch {
              return {
                viewId,
                appInstanceId: view.appInstanceId,
                tools: [],
                unavailable: true,
              };
            }
          }),
        ),
      };
    } else {
      const input = invocationSchema.parse(
        boundedAppValue(call.args, 64 * 1024),
      );
      const view = views?.get(input.viewId);
      if (!view || view.threadId !== threadId || !view.isCurrent())
        throw new Error('MCP App view is closed or belongs to another chat');
      if (!call.id || call.id.length > 256)
        throw new Error('MCP App calls require a bounded invocation ID');
      const seen = dispatched.get(view) ?? new Set<string>();
      if (seen.has(call.id))
        throw new Error(
          'MCP App invocation already dispatched; inspect the current state before a new action',
        );
      if (seen.size >= 256)
        throw new Error(
          'MCP App view invocation limit reached; reopen the view',
        );
      seen.add(call.id);
      dispatched.set(view, seen);
      result = await view.call(input);
      if (!view.isCurrent())
        throw new Error('MCP App view changed during the call');
    }
    return {
      tool_call_id: call.id,
      name: call.name,
      content: JSON.stringify(boundedAppValue(result, 1024 * 1024)),
      status:
        result &&
        typeof result === 'object' &&
        'isError' in result &&
        result.isError === true
          ? ('error' as const)
          : ('success' as const),
    };
  } catch (error) {
    return {
      tool_call_id: call.id,
      name: call.name,
      content: error instanceof Error ? error.message : 'MCP App tool failed',
      status: 'error' as const,
    };
  }
}

export class AppToolRpc {
  private pending = new Map<
    string,
    {
      resolve: (result: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private closed = false;
  constructor(
    private post: (value: unknown) => void,
    private current: () => boolean,
  ) {}

  request(method: 'tools/list' | 'tools/call', params: object = {}) {
    if (this.closed || !this.current())
      return Promise.reject(new Error('MCP App view closed'));
    if (this.pending.size >= 8)
      return Promise.reject(new Error('Too many pending MCP App requests'));
    const id = `xpert-app-${crypto.randomUUID()}`;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.post({
          jsonrpc: '2.0',
          method: 'notifications/cancelled',
          params: { requestId: id },
        });
        reject(
          new Error(
            'MCP App request timed out; mutation outcome may be unknown',
          ),
        );
      }, 30_000);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.post({ jsonrpc: '2.0', id, method, params });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  receive(value: unknown) {
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        return false;
      }
    }
    if (
      !value ||
      typeof value !== 'object' ||
      !('jsonrpc' in value) ||
      value.jsonrpc !== '2.0' ||
      !('id' in value) ||
      typeof value.id !== 'string' ||
      'method' in value
    )
      return false;
    const pending = this.pending.get(value.id);
    if (!pending) return false;
    this.pending.delete(value.id);
    clearTimeout(pending.timer);
    if (this.closed || !this.current())
      pending.reject(new Error('MCP App view closed'));
    else if ('error' in value)
      pending.reject(new Error('MCP App returned an error'));
    else if ('result' in value) {
      try {
        pending.resolve(boundedAppValue(value.result));
      } catch (error) {
        pending.reject(
          error instanceof Error ? error : new Error('Invalid App result'),
        );
      }
    } else pending.reject(new Error('Invalid MCP App response'));
    return true;
  }

  close() {
    this.closed = true;
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(
        new Error('MCP App view closed; mutation outcome may be unknown'),
      );
      this.post({
        jsonrpc: '2.0',
        method: 'notifications/cancelled',
        params: { requestId: id },
      });
    }
    this.pending.clear();
  }
}
