import type { HostPageAutomationClientToolCall } from 'packages/host-automation/src';

export const HOST_AUTOMATION_DEFAULT_RESULT_DELAY_MS = 1_000;

const DELAYED_HOST_AUTOMATION_TOOL_NAMES = new Set([
  'host_page_navigate',
  'host_page_press',
  'host_page_click',
  'host_page_scroll',
]);

export type HostAutomationDelay = (durationMs: number) => Promise<void>;

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

export function shouldDelayHostAutomationResult(
  call: HostPageAutomationClientToolCall,
): boolean {
  return DELAYED_HOST_AUTOMATION_TOOL_NAMES.has(call.name);
}

export async function withDefaultHostAutomationResultDelay<T>(
  call: HostPageAutomationClientToolCall,
  run: () => Promise<T> | T,
  delay: HostAutomationDelay = wait,
): Promise<T> {
  const result = await run();
  if (shouldDelayHostAutomationResult(call)) {
    await delay(HOST_AUTOMATION_DEFAULT_RESULT_DELAY_MS);
  }
  return result;
}
