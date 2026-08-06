export type HostPageAutomationClientToolCall = {
  name: string;
  params?: Record<string, unknown>;
  id?: string;
  tool_call_id?: string;
};

export type ClientToolMessageInput = {
  tool_call_id?: string;
  name?: string;
  status?: 'success' | 'error';
  content?: unknown;
  artifact?: unknown;
};

export type BrowserActionRisk =
  | 'password_input'
  | 'file_input'
  | 'form_submit'
  | 'cross_origin_navigation'
  | 'download';

export type ObservationScope =
  | { documentScope: 'same_document'; documentRef: string }
  | { documentScope: 'current_top' };

export type SemanticIdentity =
  | { role: string; name: string }
  | { role: string; text: string };

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

export type TargetRequest = {
  kind: string;
  pageStateId: string;
  documentRef: string;
  [key: string]: unknown;
};

export type TargetResolution = {
  requested: TargetRequest;
  strategy:
    | 'ref'
    | 'ax_ref'
    | 'test_id'
    | 'unique_selector'
    | 'semantic_exact'
    | 'coordinate';
  pageStateId: string;
  resolved?: Record<string, unknown>;
  candidates?: Array<Record<string, unknown>>;
  adjustment?: 'actionable_ancestor' | 'associated_label_control';
  point?: { x: number; y: number };
  hitTarget?: Record<string, unknown>;
  hitStack?: Array<Record<string, unknown>>;
};
