import {
  HOST_PAGE_AUTOMATION_TOOL_NAMES,
  type ActionOutcome,
  type BrowserActionResult,
  type ClientActionEvidence,
  type HostPageAutomationToolName,
} from './types';

const ACTION_OUTCOMES = new Set<ActionOutcome>([
  'verified',
  'verification_failed',
  'executed_unverified',
  'rejected_before_execution',
]);
const SENSITIVE_URL_PARAMETER =
  /(?:token|secret|password|passwd|api[-_]?key|auth|session|code|signature|credential)/i;

function redactActionUrl(value: string): string {
  try {
    const url = new URL(value);
    for (const key of url.searchParams.keys()) {
      if (SENSITIVE_URL_PARAMETER.test(key)) {
        url.searchParams.set(key, '[REDACTED]');
      }
    }
    url.hash = '';
    return url.toString();
  } catch {
    return '[REDACTED_URL]';
  }
}

export function addBrowserActionEvidence(
  action: string,
  url: string,
  value: unknown,
): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  if (
    !HOST_PAGE_AUTOMATION_TOOL_NAMES.includes(
      action as HostPageAutomationToolName,
    )
  ) {
    return value;
  }

  const result = value as Partial<BrowserActionResult> &
    Record<string, unknown>;
  if (!result.outcome || !ACTION_OUTCOMES.has(result.outcome)) {
    return value;
  }

  const pageStateId =
    result.resolution?.pageStateId ?? result.invalidatedPageStateId;
  if (!pageStateId) {
    return value;
  }

  const evidence: ClientActionEvidence = {
    timestamp: new Date().toISOString(),
    pageStateId,
    url: redactActionUrl(url),
    action: action as HostPageAutomationToolName,
    outcome: result.outcome,
    ...(result.resolution?.requested
      ? { requested: result.resolution.requested }
      : {}),
    ...(result.resolution ? { resolution: result.resolution } : {}),
    ...(result.verification ? { verification: result.verification } : {}),
  };

  return { ...result, evidence };
}
