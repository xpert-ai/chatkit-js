import * as React from 'react';
import type {
  ChatKitCommandSource,
  ChatKitSlashCommand,
} from '@xpert-ai/chatkit-types';
import {
  resolveSlashCommands,
  type ResolvedSlashCommand,
} from '../../lib/slash-commands';
import {
  createPromptDraft,
  fillPromptDraft,
  updatePromptDraft,
  type PromptDraft,
} from '../../lib/prompt-draft';
import {
  toggleRuntimeCapabilitySelection,
  type RuntimeCapabilitiesSelection,
  type RuntimeCapabilityOption,
} from '../../lib/runtime-capabilities';
import { getActionRuntimeCapabilities } from '../../lib/slash-commands/availability';

type Selection = {
  command: ResolvedSlashCommand;
  draft: PromptDraft;
  scope: string;
  runtimeCapabilities: RuntimeCapabilitiesSelection | null;
};

export function usePromptWorkflowDraft({
  draft,
  scope,
  hostCommands,
  runtimeCommands,
  setText,
  focus,
}: {
  draft: string;
  scope: string;
  hostCommands?: ChatKitSlashCommand[];
  runtimeCommands?: ChatKitSlashCommand[];
  setText: (text: string, offset?: number) => void;
  focus: (offset: number) => void;
}) {
  const commands = React.useMemo(
    () =>
      resolveSlashCommands(hostCommands, runtimeCommands).filter(
        (command) =>
          command.kind === 'prompt_workflow' &&
          command.action.type === 'insert_text' &&
          !command.availability?.disabled,
      ),
    [hostCommands, runtimeCommands],
  );
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [browsingPrompts, setBrowsingPrompts] = React.useState(false);
  const selected =
    selection?.scope === scope &&
    commands.some((command) => command.id === selection.command.id)
      ? selection
      : null;
  const current = selected
    ? { ...selected, draft: updatePromptDraft(selected.draft, draft) }
    : null;
  React.useEffect(() => {
    setSelection((previous) => {
      if (!previous) return previous;
      if (
        previous.scope !== scope ||
        !draft ||
        !commands.some((command) => command.id === previous.command.id)
      )
        return null;
      const updated = updatePromptDraft(previous.draft, draft);
      return updated === previous.draft
        ? previous
        : { ...previous, draft: updated };
    });
  }, [draft, scope, commands]);

  const select = React.useCallback(
    (command: ResolvedSlashCommand, args: string) => {
      if (
        command.kind !== 'prompt_workflow' ||
        command.action.type !== 'insert_text' ||
        command.availability?.disabled
      )
        return false;
      const next = createPromptDraft(command.action.template, args);
      setBrowsingPrompts(false);
      setSelection({
        command,
        draft: next,
        scope,
        runtimeCapabilities:
          getActionRuntimeCapabilities(command.action) ?? null,
      });
      setText(next.text, next.ranges[0]?.end ?? next.text.length);
      focus(next.ranges[0]?.end ?? next.text.length);
      return true;
    },
    [scope, setText, focus],
  );

  function selectShortcut(command: ResolvedSlashCommand) {
    // Returning to the shortcut list must not forget the template already in the draft.
    if (current?.command.id === command.id) {
      setBrowsingPrompts(false);
      focus(current.draft.ranges[0]?.end ?? draft.length);
      return;
    }
    // Scenarios and arguments belong to the selected workflow, not its replacement.
    select(command, current ? '' : draft);
  }

  function chooseScenario(args: string) {
    if (!current) return;
    const next = fillPromptDraft(current.draft, args);
    setSelection({ ...current, draft: next });
    setText(next.text, next.ranges[0]?.end ?? next.text.length);
    focus(next.ranges[0]?.end ?? next.text.length);
  }
  const removeCapability = React.useCallback(
    (option: RuntimeCapabilityOption) => {
      setSelection((previous) =>
        previous?.runtimeCapabilities
          ? {
              ...previous,
              runtimeCapabilities: toggleRuntimeCapabilitySelection(
                previous.runtimeCapabilities,
                option.type,
                option.id,
                false,
              ),
            }
          : previous,
      );
    },
    [],
  );
  const command = current?.command;
  const commandSource: ChatKitCommandSource | undefined = command
    ? {
        type: 'slash_command',
        name: command.name,
        source: command.source,
        executionType: 'insert_text',
        kind: 'prompt_workflow',
        workflow: {
          type: 'prompt_workflow',
          name: command.name,
          label: command.label,
        },
      }
    : undefined;
  return {
    commands,
    selected: current,
    shortcutCommand:
      !browsingPrompts && current?.command.workflow?.scenarios?.length
        ? current.command
        : null,
    select,
    selectShortcut,
    showPrompts: () => setBrowsingPrompts(true),
    chooseScenario,
    commandSource,
    runtimeCapabilities: current?.runtimeCapabilities ?? null,
    removeCapability,
    clear: () => setSelection(null),
    restore: (previous: Selection | null) =>
      setSelection((existing) => existing ?? previous),
  };
}
