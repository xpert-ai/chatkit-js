import type { HITLDecision, HITLRequest } from './interrupt.js';

/** Opaque host resource reference; ChatKit never interprets resource-specific policy. */
export interface ApprovalHostReference {
  kind: string;
  id: string;
  expiresAt: number;
}
export interface ApprovalDecisionRequest {
  request: HITLRequest;
  decisions: HITLDecision[];
}
export interface ApprovalActionRequest {
  request: HITLRequest;
  action: 'settings';
}
export interface ChatKitApprovalsOptions {
  /** Existing integrations keep the composer placement by default. */
  placement?: 'composer' | 'inline';
  onDecision?: (
    input: ApprovalDecisionRequest,
  ) => Promise<{ accepted: boolean }>;
  onAction?: (input: ApprovalActionRequest) => Promise<void> | void;
}
export function isApprovalHostReference(
  value: unknown,
): value is ApprovalHostReference {
  return (
    !!value &&
    typeof value === 'object' &&
    'kind' in value &&
    typeof value.kind === 'string' &&
    value.kind.length > 0 &&
    'id' in value &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    'expiresAt' in value &&
    typeof value.expiresAt === 'number' &&
    Number.isFinite(value.expiresAt)
  );
}
