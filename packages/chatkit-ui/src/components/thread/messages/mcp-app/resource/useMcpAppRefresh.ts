import * as React from 'react';
import { normalizeCallToolResult } from './tool-result';
import { isRecord } from './values';
import type { NormalizedMcpAppResource } from '../types';
import type { McpAppJsonRpcRequest } from '../host';

/** Refresh data in place; never reload an iframe or replay its opening tool. */
export function useMcpAppRefresh(options: {
  identity: string;
  refresh: NormalizedMcpAppResource['refresh'];
  ready: React.RefObject<boolean>;
  call: (request: McpAppJsonRpcRequest) => Promise<unknown>;
  post: (message: unknown) => void;
  failureMessage: string;
}) {
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const active = React.useRef<symbol | null>(null);
  React.useEffect(() => {
    active.current = null;
    setRefreshing(false);
    setError(null);
    return () => {
      active.current = null;
    };
  }, [options.identity]);
  const refresh = async () => {
    if (!options.refresh || !options.ready.current || active.current) return;
    const operation = Symbol();
    active.current = operation;
    setRefreshing(true);
    setError(null);
    try {
      const response = await options.call({
        jsonrpc: '2.0',
        id: `refresh-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: options.refresh.toolName,
          arguments: options.refresh.arguments ?? {},
        },
      });
      if (active.current !== operation) return;
      if (!isRecord(response) || response.error || !('result' in response))
        throw Error(options.failureMessage);
      const result = normalizeCallToolResult(response.result);
      if (result.isError) {
        const text = result.content.find(
          (item) => item.type === 'text' && typeof item.text === 'string',
        )?.text;
        throw Error(typeof text === 'string' ? text : options.failureMessage);
      }
      options.post({
        jsonrpc: '2.0',
        method: 'ui/notifications/tool-result',
        params: result,
      });
    } catch (cause) {
      if (active.current === operation)
        setError(
          cause instanceof Error ? cause.message : options.failureMessage,
        );
    } finally {
      if (active.current === operation) {
        active.current = null;
        setRefreshing(false);
      }
    }
  };
  return { refresh, refreshing, error };
}
