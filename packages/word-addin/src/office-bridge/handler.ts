import type { ClientToolMessageInput } from '@xpert-ai/chatkit-types';
import { createWordOfficeAdapter } from './word';
import { createOfficeToolRegistry } from './registry';
import type {
  CreateOfficeBridgeClientToolHandlerOptions,
  OfficeBridgeClientToolHandler,
  OfficeToolCall,
  OfficeToolResult,
} from './types';

function normalizeParams(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function createToolMessage(
  call: OfficeToolCall,
  status: 'success' | 'error',
  content: OfficeToolResult,
): ClientToolMessageInput {
  return {
    tool_call_id: call.tool_call_id ?? call.id,
    name: call.name,
    status,
    content: JSON.stringify(content),
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createOfficeBridgeClientToolHandler(
  options: CreateOfficeBridgeClientToolHandlerOptions = {},
): OfficeBridgeClientToolHandler {
  const registry =
    options.registry ??
    createOfficeToolRegistry([options.adapter ?? createWordOfficeAdapter()]);

  return async (call) => {
    if (!registry.supports(call.name)) {
      return createToolMessage(call, 'error', {
        ok: false,
        error: `Unknown Office tool: ${call.name}`,
      });
    }

    try {
      const result = await registry.execute(call.name, normalizeParams(call.params));
      return createToolMessage(call, 'success', { ok: true, result });
    } catch (error) {
      return createToolMessage(call, 'error', {
        ok: false,
        error: getErrorMessage(error),
      });
    }
  };
}
