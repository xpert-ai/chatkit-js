# Conversation Goals

Conversation goals let users pin a persistent objective to a ChatKit conversation. A goal is a control for work across multiple turns, rather than a normal chat message: the assistant can keep making progress, report its status, and mark the goal complete or blocked when appropriate.

Goals suit longer tasks such as implementing a feature, investigating an issue, reviewing a branch, or coordinating several follow-up steps.

## User experience

When goals are available, the **Goal** toggle below the composer enters goal-input mode. Text entered in this mode is saved as the conversation objective instead of being sent as a normal message.

Users can also manage goals with slash commands:

- `/goal ship the feature`: create or replace the active goal.
- `/goal edit ship the smaller version`: update the objective.
- `/goal pause`: pause the goal.
- `/goal resume`: resume a paused goal.
- `/goal clear`: remove the goal from the conversation.

Creating or editing a goal does not submit a normal user message. ChatKit clears the composer and updates the goal status after the operation succeeds.

If there is no conversation yet, a command or goal-input submission containing an objective can create the first goal in a new conversation. Pause, resume, and clear require an existing conversation.

## Availability

Goals are optional. ChatKit exposes `/goal` only when the connected assistant advertises that command at runtime, so it appears only for assistants with an enabled goal workflow.

If the client does not support goal controls, normal chat still works. `/goal` reports that it is unavailable rather than submitting a substitute prompt.

## Goal status

When an available goal is running, a compact status area appears above the composer. It stays visible during the goal run and disappears when the run ends. It can show the objective, status, elapsed time, and controls for editing, pausing, resuming, or clearing the goal.

| Status           | Meaning                                                                             |
| ---------------- | ----------------------------------------------------------------------------------- |
| `active`         | The assistant should continue working toward the objective.                         |
| `paused`         | The goal is saved but should not drive more work.                                   |
| `blocked`        | Progress requires user input or an external change.                                 |
| `usage_limited`  | Reserved for usage limits; the backend does not yet enter this state automatically. |
| `budget_limited` | Automatic continuation stopped at its safety limit.                                 |
| `complete`       | The objective has been achieved.                                                    |

Streamed goal updates are reflected in the UI. Clearing a goal removes its status area.

## Assistant behavior

An active goal supplies hidden conversation-level context. The assistant can inspect it and mark it complete or blocked when appropriate. User-facing pause, resume, edit, and clear operations remain under the user's control.

If a goal remains active after a response, the assistant may automatically start another model call. Continuation stops when the goal is paused, blocked, complete, reaches its safety limit, or the current run uses plan mode.

A prompt workflow changes how one message is submitted. A goal persists as conversation state and can guide multiple turns until it is resolved.

## Compatibility

- Assistants without a runtime `/goal` command do not expose goal behavior.
- Clients without goal support retain normal chat behavior.
- Other slash commands, runtime capability selection, and message submission remain available when goals are unavailable.
- Hosts can integrate goal controls while retaining consistent user-facing `/goal` behavior.

## Choosing an objective

A goal should be specific enough to distinguish active, complete, and blocked work.

Suitable examples:

- Implement the checkout error-handling change and verify the relevant tests.
- Investigate why the import flow loses selected fields.
- Review the current branch for regressions before committing.

Use normal messages for requests such as explaining a file, interpreting an error, or drafting a short reply.

Users can send normal messages while a goal is active. These steer the ongoing work; the saved objective remains until it is edited, paused, completed, blocked, or cleared.
