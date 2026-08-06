import type {
  HostPageAutomationClientToolCall,
  TargetResolution,
  VerificationResult,
} from './types.js';

const ACTION_OUTCOMES = new Set([
  'verified',
  'verification_failed',
  'executed_unverified',
  'rejected_before_execution',
]);
const SENSITIVE_URL_PARAMETER =
  /(?:token|secret|password|passwd|api[-_]?key|auth|session|code|signature|credential)/i;

function redactUrl(value: string) {
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
  action: HostPageAutomationClientToolCall['name'],
  url: string,
  value: unknown,
): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const result = value as {
    outcome?: string;
    invalidatedPageStateId?: string;
    resolution?: TargetResolution;
    verification?: VerificationResult;
  } & Record<string, unknown>;
  if (!result.outcome || !ACTION_OUTCOMES.has(result.outcome)) return value;
  const pageStateId =
    result.resolution?.pageStateId ?? result.invalidatedPageStateId;
  if (!pageStateId) return value;
  return {
    ...result,
    evidence: {
      timestamp: new Date().toISOString(),
      pageStateId,
      url: redactUrl(url),
      action,
      outcome: result.outcome,
      ...(result.resolution?.requested
        ? { requested: result.resolution.requested }
        : {}),
      ...(result.resolution ? { resolution: result.resolution } : {}),
      ...(result.verification ? { verification: result.verification } : {}),
    },
  };
}
