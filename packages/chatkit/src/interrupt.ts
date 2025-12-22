import { type ToolCall } from '@langchain/core/messages/tool';

/**
 * When an interrupt occurs during task execution, the system generates an InterruptPayload.
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
export interface InterruptPayload {
  tasks: Array<{
    id: string;
    name: string;
    path: string[];
    interrupts: Array<{
      id: string;
      value: ClientToolRequest
    }>;
  }>;
}

export interface ClientToolRequest {
  clientToolCalls: ToolCall[];
}

export interface ClientToolMessageInput {
  content: unknown
  name?: string
  tool_call_id?: string
  status?: 'success' | 'error'
  artifact?: unknown
}

export interface ClientToolResponse {
  toolMessages: ClientToolMessageInput[]
}

export function isClientToolRequest(value: any): value is ClientToolRequest {
  return (
    value &&
    Array.isArray(value.clientToolCalls)
  );
}