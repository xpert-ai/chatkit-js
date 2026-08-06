export {
  HostPageAutomationExecutor,
  isHostPageAutomationToolName,
} from './executor';
export { addBrowserActionEvidence } from './action-trace';
export { createHostPageAutomationClientToolHandler } from './handler';
export { HOST_PAGE_AUTOMATION_TOOL_SCHEMAS } from './tool-schemas';
export type { JsonSchema } from './tool-schemas';
export type {
  BrowserAutomationV2Capabilities,
  BrowserActionResult,
  BrowserActionApprovalReason,
  BrowserActionRisk,
  BrowserAutomationError,
  BrowserAutomationErrorCode,
  BrowserDocumentDescriptor,
  ActionExpectation,
  ActionOutcome,
  CoordinateTargetDescriptor,
  ClientActionEvidence,
  ElementDescriptor,
  HostPageAutomationClientToolCall,
  HostPageAutomationClientToolHandler,
  HostPageAutomationElementSnapshot,
  HostPageAutomationOptions,
  HostPageAutomationToolName,
  HostPageReadableContent,
  HostPageReadableContentBlock,
  HostPageSnapshot,
  ObservationScope,
  ObservationTargetDescriptor,
  PageBoundTarget,
  SemanticIdentity,
  TargetDescriptor,
  TargetResolution,
  VerificationResult,
} from './types';
export { HOST_PAGE_AUTOMATION_TOOL_NAMES } from './types';
