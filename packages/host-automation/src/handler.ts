import type { ClientToolMessageInput } from '@xpert-ai/chatkit-types';

import {
  HostPageAutomationExecutor,
  isHostPageAutomationToolName,
} from './executor';
import type {
  HostPageAutomationClientToolCall,
  HostPageAutomationClientToolHandler,
  HostPageAutomationOptions,
} from './types';

function normalizeParams(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function serializeContent(value: unknown): string {
  return JSON.stringify(value);
}

function createToolMessage(
  call: HostPageAutomationClientToolCall,
  status: 'success' | 'error',
  content: unknown,
): ClientToolMessageInput {
  return {
    tool_call_id: call.tool_call_id ?? call.id,
    name: call.name,
    status,
    content: serializeContent(content),
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createHostPageAutomationClientToolHandler(
  options: HostPageAutomationOptions = {},
): HostPageAutomationClientToolHandler {
  const executor = new HostPageAutomationExecutor(options);

  return async (call) => {
    if (!isHostPageAutomationToolName(call.name)) {
      return createToolMessage(call, 'error', {
        ok: false,
        error: `Unknown host page automation tool: ${call.name}`,
      });
    }

    try {
      const result = await executor.execute(
        call.name,
        normalizeParams(call.params),
      );
      return createToolMessage(call, 'success', { ok: true, result });
    } catch (error) {
      return createToolMessage(call, 'error', {
        ok: false,
        error: getErrorMessage(error),
      });
    }
  };
}
