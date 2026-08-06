import type { ClientToolMessageInput } from '@xpert-ai/chatkit-types';

import {
  HostPageAutomationExecutor,
  isHostPageAutomationToolName,
} from './executor';
import { addBrowserActionEvidence } from './action-trace';
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

function getStructuredErrorDetails(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== 'object' || Array.isArray(error)) {
    return {};
  }

  const details = Reflect.get(error, 'details');
  return details && typeof details === 'object' && !Array.isArray(details)
    ? (details as Record<string, unknown>)
    : {};
}

function hasFailedActionOutcome(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Reflect.get(value, 'outcome') === 'verification_failed'
  );
}

function getAutomationUrl(options: HostPageAutomationOptions): string {
  const rootDocument =
    options.root && 'location' in options.root
      ? options.root
      : options.root?.ownerDocument;
  return rootDocument?.location?.href ?? globalThis.location?.href ?? '';
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
      const result = addBrowserActionEvidence(
        call.name,
        getAutomationUrl(options),
        await executor.execute(call.name, normalizeParams(call.params)),
      );
      const failed = hasFailedActionOutcome(result);
      return createToolMessage(call, failed ? 'error' : 'success', {
        ok: !failed,
        result,
      });
    } catch (error) {
      const details = addBrowserActionEvidence(
        call.name,
        getAutomationUrl(options),
        getStructuredErrorDetails(error),
      );
      return createToolMessage(call, 'error', {
        ok: false,
        error: getErrorMessage(error),
        ...(details as Record<string, unknown>),
      });
    }
  };
}
