# Tools

Tools let the assistant call into your application logic during a turn—for example to search data, run a workflow, or fetch the user’s current context—then feed the results back into the model.

At a high level:

- **Server tools** run on your backend. The assistant calls them through your inference pipeline, and you stream their results back into the conversation.
- **Client tools** run in the browser or host app. ChatKit surfaces a tool call as a streamed thread item, lets the client handle it, then resumes the conversation with the tool’s output.

## Server tools

Server tools are ordinary Python (JavaScript) functions you register with your inference setup (for example, as tools on an agent or as explicit steps in your pipeline). During inference, the model can decide to call them; ChatKit serializes the call, runs your function, and feeds the output back to the model.

Use server tools to:

- Look up data in your own APIs or databases.
- Kick off long-running jobs while streaming progress updates.
- Update your own domain state (tickets, orders, files, etc.) in response to a turn.

From the model’s perspective, tools are structured, named capabilities it can invoke instead of guessing from free text.

## Client tools

Some operations can only run on the client, for example:

- Reading the current selection in a canvas or document.
- Inspecting local application state that never leaves the browser.
- Calling into the host app (for example, a design tool or IDE) via its own APIs.

Client tools let the model request that kind of data mid-turn:

- On the server, you instruct your inference pipeline to stop when a specific tool is called (for example, by using `Interrupts` around that tool).
- ChatKit turns the tool call into a streamed thread item.
- On the client, `onClientTool` receives that item, runs your callback, and returns a JSON result.
- ChatKit sends the result back to the server, which starts a new stream to continue the run with the tool output included as model input.

Use client tools when the model needs fresh, local context it cannot safely obtain from server-side state alone.

`InterruptPayload` provides a structured way to define client tool calls and their expected outputs.

## Human-in-the-loop interrupts

Human-in-the-loop (HITL) interrupts pause an agent before a proposed action runs, ask a reviewer for a decision, and then resume the same run with that decision. This is useful for actions that need oversight, such as sending email, writing files, executing SQL, or calling an irreversible business workflow.

When the server emits a LangGraph interrupt with a HITL request, ChatKit shows an action review panel above the composer and disables normal message input until the reviewer resumes or stops the run.

For historical conversations, ChatKit restores an unfinished HITL review from the conversation-level `operation.tasks[].interrupts[]` payload. The host API should keep the pending operation on the interrupted conversation until the reviewer submits a decision; ChatKit does not reconstruct pending approvals from low-level checkpoint state.

ChatKit recognizes the Xpert middleware shape:

```json
{
  "actionRequests": [
    {
      "name": "send_email",
      "args": {
        "to": "user@example.com",
        "subject": "Hello"
      },
      "description": "Review this email before sending."
    }
  ],
  "reviewConfigs": [
    {
      "actionName": "send_email",
      "allowedDecisions": ["approve", "edit", "reject"]
    }
  ]
}
```

It also normalizes the LangChain documentation shape (`action_requests`, `review_configs`, `arguments`, `action_name`, `allowed_decisions`) into the same client model.

The review panel renders only the decisions allowed by the matching `reviewConfig`:

- `approve` resumes with the original action.
- `edit` lets the reviewer modify the action arguments and resumes with `editedAction`.
- `reject` resumes with an optional message explaining why the action should not run.
- `respond` resumes with a required message for LangChain-compatible HITL flows. Xpert's `HumanInTheLoopMiddleware` currently emits `approve`, `edit`, and `reject`.

When a single review contains both approved and rejected actions, the server should continue executing the approved or edited tool calls and convert each rejected action into a tool response for the model. If every reviewed action is rejected, the server should resume the model directly with those rejection responses.

ChatKit resumes the run with the current Xpert chat request shape:

```json
{
  "action": "resume",
  "conversationId": "conversation-1",
  "target": {
    "aiMessageId": "ai-message-1",
    "executionId": "execution-1"
  },
  "decision": {
    "type": "confirm",
    "payload": {
      "decisions": [
        {
          "type": "approve"
        }
      ]
    }
  }
}
```

When ChatKit sends this through the runs API, it resolves the current thread's `conversationId` before submitting the resume request. Older payloads such as `{ "input": {}, "command": { "resume": ... } }` are still accepted by server-ai as legacy input and normalized to this shape.

The middleware resume payload inside `decision.payload` is:

```json
{
  "decisions": [
    {
      "type": "approve"
    }
  ]
}
```

For edited actions, the resume payload is:

```json
{
  "decisions": [
    {
      "type": "edit",
      "editedAction": {
        "name": "send_email",
        "args": {
          "to": "new@example.com",
          "subject": "Updated"
        }
      }
    }
  ]
}
```

The server should pass that object to the graph resume command so the interrupted middleware can continue from the reviewer decision.
