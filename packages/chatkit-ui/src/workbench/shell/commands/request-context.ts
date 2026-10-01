import type { WorkbenchAssistantContext } from '../types';

export function buildWorkbenchRequestContext(
  contexts: ReadonlyMap<string, WorkbenchAssistantContext>,
): Record<string, unknown> {
  const requestContext: Record<string, unknown> = {};
  const env: Record<string, string> = {};
  for (const [key, value] of contexts.entries()) {
    Object.assign(env, value.env ?? {});
    if (value.context) requestContext[key] = value.context;
  }
  if (Object.keys(env).length > 0) requestContext.env = env;
  return requestContext;
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return typeof error === 'string' && error.trim() ? error.trim() : fallback;
}
