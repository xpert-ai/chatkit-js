import type { ClientToolMessageInput } from '@xpert-ai/chatkit-types';

export const HOST_PAGE_AUTOMATION_TOOL_NAMES = [
  'host_page_snapshot',
  'host_page_click',
  'host_page_fill',
  'host_page_press',
  'host_page_select',
  'host_page_scroll',
  'host_page_navigate',
  'host_page_hover',
  'host_page_focus',
  'host_page_pointer',
  'host_page_screenshot',
  'host_page_read',
  'host_page_wait_for',
] as const;

export type HostPageAutomationToolName =
  (typeof HOST_PAGE_AUTOMATION_TOOL_NAMES)[number];

export type HostPageAutomationOptions = {
  enabled?: boolean;
  root?: Document | ShadowRoot;
  allowNavigation?: boolean;
  showVisualEffect?: (
    context: HostPageAutomationVisualEffectContext,
  ) => Promise<void> | void;
  showClickEffect?: (
    context: HostPageAutomationClickEffectContext,
  ) => Promise<void> | void;
};

export type HostPageAutomationClickEffectContext = {
  point: {
    x: number;
    y: number;
  };
  target: Element;
  requested?: Element;
};

export type HostPageAutomationVisualEffectType =
  | 'click'
  | 'fill'
  | 'select'
  | 'press'
  | 'scroll'
  | 'hover'
  | 'focus'
  | 'pointer'
  | 'wait_for'
  | 'screenshot';

export type HostPageAutomationVisualEffectContext = {
  type: HostPageAutomationVisualEffectType;
  point?: {
    x: number;
    y: number;
  };
  anchor?: 'target' | 'point';
  target?: Element;
  requested?: Element;
  action?: 'move' | 'down' | 'up' | 'click';
  key?: string;
  value?: string;
  values?: string[];
  state?: 'attached' | 'visible' | 'hidden' | 'detached';
  deltaX?: number;
  deltaY?: number;
  scroll?: {
    x: number;
    y: number;
  };
};

export type HostPageAutomationClientToolCall = {
  name: string;
  params?: Record<string, unknown>;
  id?: string;
  tool_call_id?: string;
};

export type HostPageAutomationClientToolHandler = (
  call: HostPageAutomationClientToolCall,
) => Promise<ClientToolMessageInput> | ClientToolMessageInput;

export type BrowserAutomationV2Capabilities = {
  targetingVersion: 2;
  strictRefs: true;
  strictCoordinates: true;
  freshState: true;
  postconditions: boolean;
  policyGate: boolean;
  actionTrace: boolean;
};

export type BrowserDocumentDescriptor = {
  documentRef: string;
  frameRef?: string;
  parentDocumentRef?: string;
  sameOrigin: boolean;
};

export type PageBoundTarget = {
  pageStateId: string;
  documentRef: string;
};

export type SemanticIdentity =
  | { role: string; name: string }
  | { role: string; text: string };

export type TargetDescriptor =
  | (PageBoundTarget & { kind: 'ref'; ref: string })
  | (PageBoundTarget & { kind: 'ax_ref'; axRef: string })
  | (PageBoundTarget & { kind: 'test_id'; testId: string })
  | (PageBoundTarget & { kind: 'selector'; selector: string })
  | (PageBoundTarget & {
      kind: 'semantic';
      match: 'exact';
      identity: SemanticIdentity;
    });

export type CoordinateTargetDescriptor = PageBoundTarget & {
  kind: 'coordinate';
  x: number;
  y: number;
  coordinateSpace: 'viewport-css-px' | 'viewport_normalized';
  targetText: string;
  targetRole?: string;
  targetContext?: string;
};

export type ElementDescriptor = {
  documentRef: string;
  ref?: string;
  axRef?: string;
  tag: string;
  role?: string;
  name?: string;
  text?: string;
  testId?: string;
  rect: { x: number; y: number; width: number; height: number };
};

export type TargetResolution = {
  requested: TargetDescriptor | CoordinateTargetDescriptor;
  strategy:
    | 'ref'
    | 'ax_ref'
    | 'test_id'
    | 'unique_selector'
    | 'semantic_exact'
    | 'coordinate';
  resolved?: ElementDescriptor;
  candidates?: ElementDescriptor[];
  adjustment?: 'actionable_ancestor' | 'associated_label_control';
  point?: { x: number; y: number };
  hitTarget?: ElementDescriptor;
  hitStack?: ElementDescriptor[];
  pageStateId: string;
};

export type BrowserAutomationErrorCode =
  | 'stale_page_state'
  | 'stale_target'
  | 'target_not_found'
  | 'ambiguous_target'
  | 'unsafe_selector'
  | 'non_unique_selector'
  | 'target_disabled'
  | 'target_occluded'
  | 'coordinate_target_mismatch'
  | 'coordinate_target_ambiguous'
  | 'unsupported_target_scope'
  | 'approval_required';

export type BrowserActionRisk =
  | 'password_input'
  | 'file_input'
  | 'form_submit'
  | 'cross_origin_navigation'
  | 'download';

export type BrowserActionApprovalReason =
  | 'approval_required'
  | 'invalid_or_used_token'
  | 'expired_token'
  | 'state_mismatch'
  | 'action_mismatch';

export type BrowserAutomationError = {
  code: BrowserAutomationErrorCode;
  message: string;
  recoverable: boolean;
  resolution?: TargetResolution;
  actionToken?: string;
  approvalReason?: BrowserActionApprovalReason;
  expiresAt?: string;
  risks?: BrowserActionRisk[];
};

export type ActionOutcome =
  | 'verified'
  | 'verification_failed'
  | 'executed_unverified'
  | 'rejected_before_execution';

export type ObservationScope =
  | { documentScope: 'same_document'; documentRef: string }
  | { documentScope: 'current_top' };

export type ObservationTargetDescriptor =
  | (ObservationScope & { kind: 'test_id'; testId: string })
  | (ObservationScope & { kind: 'selector'; selector: string })
  | (ObservationScope & {
      kind: 'semantic';
      match: 'exact';
      identity: SemanticIdentity;
    });

export type ActionExpectation =
  | {
      type: 'field_contains';
      target: ObservationTargetDescriptor;
      value: string;
    }
  | {
      type: 'checked_equals';
      target: ObservationTargetDescriptor;
      value: boolean;
    }
  | { type: 'element_visible'; target: ObservationTargetDescriptor }
  | { type: 'element_hidden'; target: ObservationTargetDescriptor }
  | { type: 'url_matches'; mode: 'exact' | 'prefix'; value: string }
  | { type: 'text_visible'; scope: ObservationScope; value: string };

export type VerificationResult = {
  status: 'passed' | 'failed' | 'timed_out';
  expectation: ActionExpectation;
  elapsedMs: number;
  actual?: string | boolean | null;
};

export type ClientActionEvidence = {
  timestamp: string;
  pageStateId: string;
  url: string;
  requested?: TargetDescriptor | CoordinateTargetDescriptor;
  resolution?: TargetResolution;
  action: HostPageAutomationToolName;
  outcome: ActionOutcome;
  verification?: VerificationResult;
  beforeScreenshotId?: string;
  afterScreenshotId?: string;
};

export type BrowserActionResult = {
  dispatched: boolean;
  outcome: ActionOutcome;
  requiresFreshSnapshot: boolean;
  invalidatedPageStateId?: string;
  resolution?: TargetResolution;
  verification?: VerificationResult;
  evidence?: ClientActionEvidence;
  error?: BrowserAutomationError;
};

export type HostPageAutomationElementSnapshot = {
  documentRef: string;
  ref: string;
  tag: string;
  role?: string;
  name?: string;
  label?: string;
  groupLabel?: string;
  text?: string;
  nearbyText?: string[];
  testId?: string;
  value?: string;
  selectedLabel?: string;
  options?: Array<{
    label: string;
    value: string;
    selected?: boolean;
    disabled?: boolean;
  }>;
  placeholder?: string;
  selector?: string;
  disabled?: boolean;
  enabled?: boolean;
  checked?: boolean;
  visible?: boolean;
  actionable?: boolean;
  receivesEvents?: boolean;
  occludedBy?: {
    tag: string;
    role?: string;
    name?: string;
    selector?: string;
  };
  safeClickPoints?: Array<{
    x: number;
    y: number;
  }>;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  center?: {
    x: number;
    y: number;
  };
  hitTarget?: {
    tag: string;
    role?: string;
    name?: string;
    selector?: string;
  };
  hitStack?: Array<{
    tag: string;
    role?: string;
    name?: string;
    selector?: string;
  }>;
};

export type HostPageReadableContentBlockType =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'keyValueList'
  | 'table';

export type HostPageReadableContentBlock = {
  blockId: string;
  type: HostPageReadableContentBlockType;
  heading?: string;
  level?: number;
  text?: string;
  items?: string[];
  fields?: Array<{
    name: string;
    value: string;
  }>;
  headers?: string[];
  rows?: string[][];
  preview: string[];
  itemCount: number;
  chars: number;
  truncated: boolean;
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  readHint: {
    tool: 'host_page_read';
    args: {
      blockId: string;
    };
  };
};

export type HostPageReadableContentOutlineItem = {
  index: number;
  blockId: string;
  type: HostPageReadableContentBlockType;
  heading?: string;
  level?: number;
  itemCount: number;
  chars: number;
  truncated: boolean;
};

export type HostPageReadableContentSuggestedRead = {
  blockId: string;
  type: HostPageReadableContentBlockType;
  heading?: string;
  reason: string;
  args: {
    blockId: string;
    pageSize?: number;
  };
};

export type HostPageReadableContent = {
  blocks: HostPageReadableContentBlock[];
  outline?: HostPageReadableContentOutlineItem[];
  suggestedReads?: HostPageReadableContentSuggestedRead[];
  totalBlocks: number;
  truncated: boolean;
  coverage: {
    status: 'complete' | 'partial';
    visibleTextCaptured: boolean;
    truncatedBlocks: number;
    collapsedSections: number;
    crossOriginFrames: number;
    virtualizedListsDetected: number;
    visualOnlyRegions: number;
  };
  warnings?: string[];
};

export type HostPageSnapshot = {
  pageStateId: string;
  url: string;
  title: string;
  capabilities: BrowserAutomationV2Capabilities & {
    cdp?: boolean;
    realInput?: boolean;
    screenshot?: boolean;
    accessibility?: boolean;
    networkState?: boolean;
  };
  documents: BrowserDocumentDescriptor[];
  viewport: {
    width: number;
    height: number;
    devicePixelRatio?: number;
  };
  scroll: {
    x: number;
    y: number;
  };
  page?: {
    readyState?: string;
    visibilityState?: string;
    focusedElement?: HostPageAutomationElementSnapshot;
    selection?: string;
  };
  navigation?: {
    type?: string;
    duration?: number;
    domContentLoaded?: number;
    loadEventEnd?: number;
  };
  frames?: Array<{
    url?: string;
    title?: string;
    sameOrigin: boolean;
    rect?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  accessibility?: Array<{
    ref?: string;
    role?: string;
    name?: string;
    value?: string;
    disabled?: boolean;
    checked?: boolean;
    expanded?: boolean;
    focused?: boolean;
  }>;
  readableContent?: HostPageReadableContent;
  elements: HostPageAutomationElementSnapshot[];
};
