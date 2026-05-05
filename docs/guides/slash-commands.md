# Slash Commands

Slash commands give ChatKit a command palette inside the composer. They cover three related workflows:

- UI commands such as `/plan`
- Prompt workflow commands such as `/review src/app.ts`
- Runtime capability selection for skills, plugins, and sub-agents

Command execution does not bypass the normal ChatKit and Xpert request flow. Submitted prompts still go through `stream.submit`, runtime capability allow-lists still apply, and command metadata is added to the submitted human input for auditing and debugging.

## User Experience

When a user types `/` at the beginning of the composer, ChatKit opens the slash palette and shows:

- built-in ChatKit commands
- host-provided static commands from `composer.slashCommands`
- Xpert runtime commands from `runtimeCapabilities.commands`
- expandable Skills, Plugins, and Sub-agents groups for selecting runtime capabilities

When a user types `/` after whitespace in the middle of a message, ChatKit only shows runtime capabilities. Selecting a skill, plugin, or sub-agent inserts an atomic token into the contenteditable composer. The token:

- renders with the capability icon or avatar
- cannot be partially edited
- is deleted as a whole with Backspace or Delete
- is included in the displayed human message after submit
- contributes a run-only runtime capability allow-list for the next request
- is cleared after the request is sent

The palette supports mouse selection plus keyboard navigation with Escape, ArrowUp, ArrowDown, Tab, and Enter. Active keyboard navigation keeps the selected item scrolled into view.

## Command Sources

Commands are resolved in this order:

1. Built-in commands
2. Host static commands from `ChatKitOptions.composer.slashCommands`
3. Xpert runtime commands from `RuntimeCapabilitiesResponse.commands`

Built-in names are reserved. Host commands win over runtime commands with the same name. Duplicate commands are hidden and ChatKit logs a `console.warn`.

Command names do not include the leading `/`. Valid names use lowercase letters, numbers, hyphens, and underscores:

```text
review
security-review
test_file
```

## Public Types

Host applications can provide static commands through `ChatKitOptions`:

```ts
import type { ChatKitOptions } from '@xpert-ai/chatkit';

const options: ChatKitOptions = {
  composer: {
    slashCommands: [
      {
        name: 'review',
        label: 'Review',
        description: 'Review selected files',
        argsHint: '<path>',
        kind: 'prompt_workflow',
        workflow: {
          type: 'prompt_workflow',
          tags: ['quality'],
        },
        action: {
          type: 'submit_prompt',
          template: 'Review this code: {{args}}',
        },
      },
    ],
  },
};
```

Runtime commands use the same shape in `RuntimeCapabilitiesResponse.commands`:

```ts
type RuntimeCapabilitiesResponse = {
  skills: RuntimeCapabilitySkill[];
  plugins: RuntimeCapabilityPlugin[];
  subAgents?: RuntimeCapabilitySubAgent[];
  commands?: RuntimeSlashCommand[];
};
```

## Command Shape

```ts
type ChatKitSlashCommand = {
  name: string;
  label?: string;
  description?: string;
  icon?: string | Record<string, unknown>;
  category?: string;
  aliases?: string[];
  argsHint?: string;
  availability?: {
    disabled?: boolean;
    reason?: string;
    [key: string]: unknown;
  };
  kind?: 'command' | 'prompt_workflow';
  workflow?: {
    type: 'prompt_workflow';
    name?: string;
    label?: string;
    description?: string;
    tags?: string[];
  };
  action: ChatKitSlashCommandAction;
  source?: Record<string, unknown>;
  meta?: Record<string, unknown>;
};
```

`category`, `aliases`, `argsHint`, `kind`, and `workflow` are optional. They are used for palette grouping, search, display, and submission metadata.

## Action Types

ChatKit supports five command action types.

### `insert_text`

Renders a template and writes it into the composer without submitting.

```ts
{
  name: 'draft-review',
  action: {
    type: 'insert_text',
    template: 'Please review {{args}} for correctness.',
  },
}
```

### `insert_invocation`

Writes a slash invocation such as `/review ` into the composer and leaves final submission to the server. This is useful for prompt workflows that should keep the user's raw `/command args` text until backend expansion.

```ts
{
  name: 'review',
  kind: 'prompt_workflow',
  action: {
    type: 'insert_invocation',
    template: '/review ',
  },
}
```

### `submit_prompt`

Renders a template and submits it as a user message. `{{args}}` is replaced by the text after the command name.

```ts
{
  name: 'review',
  kind: 'prompt_workflow',
  action: {
    type: 'submit_prompt',
    template: 'Review {{args}}',
    runtimeCapabilities: {
      mode: 'allowlist',
      skills: { ids: ['skill-review'] },
      plugins: { nodeKeys: [] },
      subAgents: { nodeKeys: [] },
    },
  },
}
```

Submitting `/review src/app.ts` sends `Review src/app.ts`.

If `runtimeCapabilities` is present on the action, ChatKit merges it into the current run-only capability selection for that submit.

### `client_action`

Notifies the host application through the parent bridge.

```ts
{
  name: 'open-ticket',
  action: {
    type: 'client_action',
    action: {
      type: 'tickets.open',
      payload: { source: 'chat' },
    },
  },
}
```

ChatKit sends the action as an `onWidgetAction` command with a `slash_command` widget item. Built-in UI commands also use `client_action` internally, but ChatKit handles their low-risk behavior directly.

### `select_capability`

Selects a runtime skill, plugin, or sub-agent.

```ts
{
  name: 'code-reviewer',
  action: {
    type: 'select_capability',
    capability: {
      type: 'skill',
      id: 'skill-review',
    },
  },
}
```

When the capability is available in the current runtime capability response, ChatKit inserts an atomic composer token. If the palette option is not currently loaded, ChatKit still updates the run-only capability allow-list.

## Built-in Commands

| Command          | Behavior                                           |
| ---------------- | -------------------------------------------------- |
| `/plan`          | Toggles plan mode.                                 |
| `/plan <prompt>` | Submits `<prompt>` with `planMode: true`.          |
| `/skills`        | Expands the Skills group in the slash palette.     |
| `/plugins`       | Expands the Plugins group in the slash palette.    |
| `/subagents`     | Expands the Sub-agents group in the slash palette. |

## Prompt Workflow Commands

Prompt workflows are slash commands that turn a short command invocation into a structured prompt. They are the ChatKit and Xpert equivalent of commands such as `/review`, `/explain`, `/test`, and `/debug`.

A prompt workflow command should use:

- `action.type: 'submit_prompt'`
- `kind: 'prompt_workflow'`
- optional `workflow` metadata for display, search, analytics, and debugging
- optional `runtimeCapabilities` to pin the skill or tool context required by the workflow

Example:

```ts
{
  name: 'security-review',
  label: 'Security Review',
  description: 'Review code for security issues',
  argsHint: '<path>',
  category: 'prompt_workflow',
  kind: 'prompt_workflow',
  workflow: {
    type: 'prompt_workflow',
    tags: ['security', 'code'],
  },
  action: {
    type: 'submit_prompt',
    template: 'Run a security review for {{args}}. Return findings by severity.',
  },
}
```

## Submission Payload

When a command submits a prompt, ChatKit writes command metadata to both the request input and `state.human`.

Example for `/review src/app.ts`:

```json
{
  "input": {
    "input": "Review src/app.ts",
    "runtimeCapabilities": {
      "mode": "allowlist",
      "skills": { "workspaceId": "workspace_123", "ids": ["skill-review"] },
      "plugins": { "nodeKeys": [] },
      "subAgents": { "nodeKeys": [] }
    },
    "commandSource": {
      "type": "slash_command",
      "name": "review",
      "source": "runtime",
      "executionType": "submit_prompt",
      "kind": "prompt_workflow",
      "workflow": {
        "type": "prompt_workflow",
        "name": "review",
        "label": "Review",
        "description": "Review selected files"
      }
    }
  },
  "state": {
    "human": {
      "input": "Review src/app.ts",
      "commandSource": {
        "type": "slash_command",
        "name": "review",
        "source": "runtime",
        "executionType": "submit_prompt",
        "kind": "prompt_workflow"
      }
    }
  }
}
```

This metadata is informational. Xpert should still enforce normal assistant access, skill access, plugin access, and runtime capability allow-list rules.

## Xpert Runtime Commands

Xpert can expose commands from installed skill packages through:

```http
GET /ai/assistants/:id/runtime-capabilities
```

Skill packages declare commands in `metadata.commands`. The Xpert server validates them before returning them to ChatKit:

- invalid names are discarded
- unknown action types are discarded
- empty `insert_text`, `insert_invocation`, and `submit_prompt` templates are discarded
- unsafe capability selection is discarded
- returned command runtime capabilities are restricted to the owning installed skill
- `submit_prompt` skill commands are normalized as prompt workflow commands

For details on runtime skills and plugin selection, see [Runtime Skills and Plugins Selection](./runtime-capabilities.md).

## Compatibility

- If the runtime capability endpoint does not return `commands`, ChatKit still shows built-in and host commands.
- If a host app does not configure `composer.slashCommands`, built-in commands and runtime capability selection still work.
- Existing programmatic `sendUserMessage` calls are unchanged unless the caller provides command metadata manually.
- Command execution never runs arbitrary shell commands.
- Commands cannot bypass Xpert permissions, tool preferences, or runtime capability allow-lists.

## Testing Checklist

Recommended coverage:

- `/` at message start shows commands plus capabilities.
- `/` after whitespace shows capabilities only.
- built-in names cannot be overridden.
- host commands win over runtime command name conflicts.
- `{{args}}` renders correctly for `insert_text`, `insert_invocation`, and `submit_prompt`.
- `insert_invocation` submits the raw `/command args` input for backend expansion.
- `submit_prompt` sends `input.commandSource`.
- prompt workflows include `kind: 'prompt_workflow'` and workflow metadata.
- runtime command capability selections merge into the submitted allow-list.
- selected skill, plugin, and sub-agent tokens render with real icons or avatars.
- atomic composer tokens cannot be partially edited and delete as a whole.
- Chinese IME composition does not trigger broken input updates.
- palette keyboard navigation scrolls the active item into view.
