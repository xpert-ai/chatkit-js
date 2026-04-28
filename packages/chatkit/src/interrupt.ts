import { type ToolCall } from '@langchain/core/messages/tool';

export const REQUEST_USER_INPUT_TOOL_NAME = 'request_user_input';
export type RequestUserInputToolName = typeof REQUEST_USER_INPUT_TOOL_NAME;

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

export type InterruptRequest = ToolCallRequest | ClientToolRequest;

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

/**
 * When an interrupt occurs during task execution, the system generates an InterruptPayload.
 *
 * Ordinary tool-call interrupts use `toolCalls`; ChatKit client-tool middleware
 * uses `clientToolCalls` so the UI can route those calls to the client.
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

export function isClientToolRequest(
  value: unknown,
): value is ClientToolRequest {
  return isRecord(value) && Array.isArray(value.clientToolCalls);
}

export function isToolCallRequest(value: unknown): value is ToolCallRequest {
  return isRecord(value) && Array.isArray(value.toolCalls);
}

export function isInterruptRequest(value: unknown): value is InterruptRequest {
  return isToolCallRequest(value) || isClientToolRequest(value);
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
