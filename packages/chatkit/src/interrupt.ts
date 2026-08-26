import { type ToolCall } from '@langchain/core/messages/tool';

export const REQUEST_USER_INPUT_TOOL_NAME = 'request_user_input';
export type RequestUserInputToolName = typeof REQUEST_USER_INPUT_TOOL_NAME;
export const REQUEST_USER_INPUT_RESULT_TYPE = 'request_user_input_result';
export type RequestUserInputResultType = typeof REQUEST_USER_INPUT_RESULT_TYPE;
export const REQUEST_USER_INPUT_RESULT_PURPOSE_PLAN_CLARIFICATION =
  'plan_clarification';
export const REQUEST_USER_INPUT_RESULT_PURPOSE_IMPLEMENTATION_CONFIRMATION =
  'implementation_confirmation';
export type RequestUserInputResultPurpose =
  | typeof REQUEST_USER_INPUT_RESULT_PURPOSE_PLAN_CLARIFICATION
  | typeof REQUEST_USER_INPUT_RESULT_PURPOSE_IMPLEMENTATION_CONFIRMATION;

export interface RequestUserInputOption {
  label: string;
  description: string;
}

export interface RequestUserInputQuestion {
  id: string;
  header: string;
  question: string;
  options: RequestUserInputOption[];
}

export interface RequestUserInputParams {
  questions: RequestUserInputQuestion[];
}

export type RequestUserInputToolArgs = RequestUserInputParams;

export type RequestUserInputAnswerType = 'option' | 'other';

export interface RequestUserInputAnswer {
  id: string;
  question: string;
  value: string;
  type: RequestUserInputAnswerType;
  label?: string;
  description?: string;
}

export interface RequestUserInputResult {
  type: RequestUserInputResultType;
  purpose: RequestUserInputResultPurpose;
  answers: RequestUserInputAnswer[];
}

export type RequestUserInputToolCall = ToolCall & {
  name: RequestUserInputToolName;
  args: RequestUserInputToolArgs;
  id: string;
  type?: 'tool_call';
};

export interface ClientToolRequest {
  clientToolCalls: ToolCall[];
}

export interface ToolCallRequest {
  toolCalls: ToolCall[];
}

export const HITL_DECISION_TYPES = [
  'approve',
  'edit',
  'reject',
  'respond',
] as const;

export type HITLDecisionType = (typeof HITL_DECISION_TYPES)[number];

export interface HITLAction {
  name: string;
  args: Record<string, unknown>;
}

export interface HITLActionRequest extends HITLAction {
  description?: string;
}

export interface HITLReviewConfig {
  actionName: string;
  allowedDecisions: HITLDecisionType[];
  argsSchema?: Record<string, unknown>;
}

export interface HITLBooleanElicitationField {
  name: string;
  type: 'boolean';
  title?: string;
  required: true;
}

export interface HITLMCPElicitation {
  kind: 'mcp_elicitation';
  actionName: string;
  field: HITLBooleanElicitationField;
}

export interface HITLRequest {
  actionRequests: HITLActionRequest[];
  reviewConfigs: HITLReviewConfig[];
  elicitation?: HITLMCPElicitation;
}

export interface HITLApproveDecision {
  type: 'approve';
}

export interface HITLEditDecision {
  type: 'edit';
  editedAction: HITLAction;
}

export interface HITLRejectDecision {
  type: 'reject';
  message?: string;
}

export interface HITLRespondDecision {
  type: 'respond';
  message: string;
}

export type HITLDecision =
  | HITLApproveDecision
  | HITLEditDecision
  | HITLRejectDecision
  | HITLRespondDecision;

export interface HITLResponse {
  decisions: HITLDecision[];
}

export type InterruptRequest =
  | ToolCallRequest
  | ClientToolRequest
  | HITLRequest;

export interface LangGraphInterrupt<TValue = unknown> {
  id: string;
  value: TValue;
  when?: string;
  resumable?: boolean;
  ns?: string[];
}

export interface LangGraphInterruptTask<TValue = unknown> {
  id: string;
  name: string;
  path: Array<string | number>;
  interrupts: Array<LangGraphInterrupt<TValue>>;
}

export interface LangGraphInterruptPayload<TValue = unknown> {
  tasks: Array<LangGraphInterruptTask<TValue>>;
}

export type ClientToolInterrupt<
  TRequest extends ClientToolRequest = ClientToolRequest,
> = LangGraphInterrupt<TRequest>;

export type ClientToolInterruptTask<
  TRequest extends ClientToolRequest = ClientToolRequest,
> = LangGraphInterruptTask<TRequest>;

export type ClientToolInterruptPayload<
  TRequest extends ClientToolRequest = ClientToolRequest,
> = LangGraphInterruptPayload<TRequest>;

export type ToolCallInterrupt<
  TRequest extends ToolCallRequest = ToolCallRequest,
> = LangGraphInterrupt<TRequest>;

export type ToolCallInterruptTask<
  TRequest extends ToolCallRequest = ToolCallRequest,
> = LangGraphInterruptTask<TRequest>;

export type ToolCallInterruptPayload<
  TRequest extends ToolCallRequest = ToolCallRequest,
> = LangGraphInterruptPayload<TRequest>;

export type HITLInterrupt<TRequest extends HITLRequest = HITLRequest> =
  LangGraphInterrupt<TRequest>;

export type HITLInterruptTask<TRequest extends HITLRequest = HITLRequest> =
  LangGraphInterruptTask<TRequest>;

export type HITLInterruptPayload<TRequest extends HITLRequest = HITLRequest> =
  LangGraphInterruptPayload<TRequest>;

/**
 * When an interrupt occurs during task execution, the system generates an InterruptPayload.
 *
 * Ordinary tool-call interrupts use `toolCalls`; ChatKit client-tool middleware
 * uses `clientToolCalls` so the UI can route those calls to the client.
 * Human-in-the-loop interrupts use `actionRequests` and `reviewConfigs` so
 * ChatKit can collect reviewer decisions and resume with `{ decisions }`.
```json
{
  "type": "event",
  "event": "on_interrupt",
  "data": {
    "tasks": [
      {
        "id": "9c4d2ac5-8808-5b6f-855c-4d48aa3d77a7",
        "name": "Middleware_wPzR2bIXqE_after_model",
        "path": ["__pregel_pull", "Middleware_wPzR2bIXqE_after_model"],
        "interrupts": [
          {
            "id": "b42f7887d65e57ed11cf08b8927763db",
            "value": {
              "toolCalls": [
                {
                  "name": "getUserStation",
                  "args": {
                    "input": "Query the site selected by the user"
                  },
                  "id": "call_00_swcaUjIaACXOHHaZyNmQB3Vm",
                  "type": "tool_call"
                }
              ]
            }
          }
        ]
      }
    ]
  }
}
```
 */
export interface InterruptPayload extends LangGraphInterruptPayload<InterruptRequest> {}

export interface ClientToolMessageInput {
  content: unknown;
  name?: string;
  tool_call_id?: string;
  status?: 'success' | 'error';
  artifact?: unknown;
}

export interface ClientToolResponse {
  toolMessages: ClientToolMessageInput[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readRecordField(
  value: Record<string, unknown>,
  ...keys: string[]
): Record<string, unknown> | null {
  for (const key of keys) {
    const field = value[key];
    if (isRecord(field)) return field;
  }

  return null;
}

function readArrayField(value: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const field = value[key];
    if (Array.isArray(field)) return field;
  }

  return null;
}

function readStringField(
  value: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const field = value[key];
    if (typeof field === 'string' && field.trim()) return field;
  }

  return null;
}

export function isHITLDecisionType(
  value: unknown,
): value is HITLDecisionType {
  return (
    typeof value === 'string' &&
    (HITL_DECISION_TYPES as readonly string[]).includes(value)
  );
}

function normalizeHITLActionRequest(
  value: unknown,
): HITLActionRequest | null {
  if (!isRecord(value)) return null;

  const name = readStringField(value, 'name');
  const args = readRecordField(value, 'args', 'arguments');
  if (!name || !args) return null;

  const description =
    typeof value.description === 'string' ? value.description : undefined;

  return {
    name,
    args,
    ...(description !== undefined ? { description } : {}),
  };
}

function normalizeHITLReviewConfig(
  value: unknown,
): HITLReviewConfig | null {
  if (!isRecord(value)) return null;

  const actionName = readStringField(value, 'actionName', 'action_name');
  const allowedDecisions = readArrayField(
    value,
    'allowedDecisions',
    'allowed_decisions',
  );
  if (!actionName || !allowedDecisions) return null;

  const normalizedDecisions = allowedDecisions.filter(isHITLDecisionType);
  if (normalizedDecisions.length !== allowedDecisions.length) return null;

  const argsSchema = readRecordField(value, 'argsSchema', 'args_schema');

  return {
    actionName,
    allowedDecisions: normalizedDecisions,
    ...(argsSchema ? { argsSchema } : {}),
  };
}

function normalizeHITLMCPElicitation(
  value: unknown,
): HITLMCPElicitation | null {
  if (!isRecord(value) || value.kind !== 'mcp_elicitation') return null;

  const actionName = readStringField(value, 'actionName');
  const field = readRecordField(value, 'field');
  if (!actionName || !field) return null;

  const name = readStringField(field, 'name');
  if (!name || field.type !== 'boolean' || field.required !== true) {
    return null;
  }
  if (field.title !== undefined && typeof field.title !== 'string') {
    return null;
  }

  const title = readStringField(field, 'title');
  return {
    kind: 'mcp_elicitation',
    actionName,
    field: {
      name,
      type: 'boolean',
      required: true,
      ...(title ? { title } : {}),
    },
  };
}

export function normalizeHITLRequest(value: unknown): HITLRequest | null {
  if (!isRecord(value)) return null;

  const actionRequests = readArrayField(
    value,
    'actionRequests',
    'action_requests',
  );
  const reviewConfigs = readArrayField(
    value,
    'reviewConfigs',
    'review_configs',
  );
  if (
    !actionRequests ||
    !reviewConfigs ||
    actionRequests.length === 0 ||
    reviewConfigs.length === 0
  ) {
    return null;
  }

  const normalizedActionRequests = actionRequests.map(
    normalizeHITLActionRequest,
  );
  const normalizedReviewConfigs = reviewConfigs.map(
    normalizeHITLReviewConfig,
  );
  if (
    normalizedActionRequests.some((request) => request === null) ||
    normalizedReviewConfigs.some((config) => config === null)
  ) {
    return null;
  }

  const normalizedRequest: HITLRequest = {
    actionRequests: normalizedActionRequests as HITLActionRequest[],
    reviewConfigs: normalizedReviewConfigs as HITLReviewConfig[],
  };
  const elicitation = normalizeHITLMCPElicitation(value.elicitation);
  if (!elicitation || normalizedRequest.actionRequests.length !== 1) {
    return normalizedRequest;
  }

  const action = normalizedRequest.actionRequests[0];
  const config = normalizedRequest.reviewConfigs.find(
    (reviewConfig) => reviewConfig.actionName === elicitation.actionName,
  );
  if (
    !action ||
    action.name !== elicitation.actionName ||
    !config ||
    typeof action.args[elicitation.field.name] !== 'boolean' ||
    !config.allowedDecisions.includes('approve') ||
    !config.allowedDecisions.includes('reject')
  ) {
    return normalizedRequest;
  }

  return { ...normalizedRequest, elicitation };
}

export function isClientToolRequest(
  value: unknown,
): value is ClientToolRequest {
  return isRecord(value) && Array.isArray(value.clientToolCalls);
}

export function isToolCallRequest(value: unknown): value is ToolCallRequest {
  return isRecord(value) && Array.isArray(value.toolCalls);
}

export function isHITLRequest(value: unknown): value is HITLRequest {
  if (!isRecord(value)) return false;
  if (
    !Array.isArray(value.actionRequests) ||
    !Array.isArray(value.reviewConfigs)
  ) {
    return false;
  }

  return normalizeHITLRequest(value) !== null;
}

export function isInterruptRequest(value: unknown): value is InterruptRequest {
  return (
    isToolCallRequest(value) ||
    isClientToolRequest(value) ||
    isHITLRequest(value)
  );
}

export function isLangGraphInterrupt(
  value: unknown,
): value is LangGraphInterrupt {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    Object.prototype.hasOwnProperty.call(value, 'value')
  );
}

export function isLangGraphInterruptTask(
  value: unknown,
): value is LangGraphInterruptTask {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    !Array.isArray(value.path) ||
    !Array.isArray(value.interrupts)
  ) {
    return false;
  }

  return (
    value.path.every(
      (item) => typeof item === 'string' || typeof item === 'number',
    ) && value.interrupts.every(isLangGraphInterrupt)
  );
}

export function isLangGraphInterruptPayload(
  value: unknown,
): value is LangGraphInterruptPayload {
  return (
    isRecord(value) &&
    Array.isArray(value.tasks) &&
    value.tasks.every(isLangGraphInterruptTask)
  );
}

export function isClientToolInterrupt(
  value: unknown,
): value is ClientToolInterrupt {
  return isLangGraphInterrupt(value) && isClientToolRequest(value.value);
}

export function isClientToolInterruptTask(
  value: unknown,
): value is ClientToolInterruptTask {
  return (
    isLangGraphInterruptTask(value) &&
    value.interrupts.every(isClientToolInterrupt)
  );
}

export function isClientToolInterruptPayload(
  value: unknown,
): value is ClientToolInterruptPayload {
  return (
    isLangGraphInterruptPayload(value) &&
    value.tasks.every(isClientToolInterruptTask)
  );
}

export function isToolCallInterrupt(
  value: unknown,
): value is ToolCallInterrupt {
  return isLangGraphInterrupt(value) && isToolCallRequest(value.value);
}

export function isToolCallInterruptTask(
  value: unknown,
): value is ToolCallInterruptTask {
  return (
    isLangGraphInterruptTask(value) &&
    value.interrupts.every(isToolCallInterrupt)
  );
}

export function isToolCallInterruptPayload(
  value: unknown,
): value is ToolCallInterruptPayload {
  return (
    isLangGraphInterruptPayload(value) &&
    value.tasks.every(isToolCallInterruptTask)
  );
}

export function isHITLInterrupt(value: unknown): value is HITLInterrupt {
  return isLangGraphInterrupt(value) && isHITLRequest(value.value);
}

export function isHITLInterruptTask(
  value: unknown,
): value is HITLInterruptTask {
  return (
    isLangGraphInterruptTask(value) && value.interrupts.every(isHITLInterrupt)
  );
}

export function isHITLInterruptPayload(
  value: unknown,
): value is HITLInterruptPayload {
  return (
    isLangGraphInterruptPayload(value) && value.tasks.every(isHITLInterruptTask)
  );
}
