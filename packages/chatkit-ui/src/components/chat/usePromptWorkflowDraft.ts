import * as React from 'react';
import type { ChatKitSlashCommand } from '@xpert-ai/chatkit-types';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import {
  getSlashCommandSource,
  parseSlashCommandInvocation,
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
  hasRuntimeCapabilitySelection,
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
  const { i18n } = useChatkitTranslation();
  const commands = React.useMemo(
    () =>
      resolveSlashCommands(hostCommands, runtimeCommands).filter(
        (command) =>
          command.kind === 'prompt_workflow' && !command.availability?.disabled,
      ),
    [hostCommands, runtimeCommands],
  );
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [browsingPrompts, setBrowsingPrompts] = React.useState(false);
  const selected =
    selection?.scope === scope &&
    (draft !== '' || selection.draft.text === '') &&
    commands.some((command) => command.id === selection.command.id) &&
    (selection.command.action.type !== 'insert_invocation' ||
      parseSlashCommandInvocation(draft)?.name === selection.command.name)
      ? selection
      : null;
  const updatedDraft = selected && updatePromptDraft(selected.draft, draft);
  const current =
    selected && updatedDraft ? { ...selected, draft: updatedDraft } : null;
  React.useEffect(() => {
    if (!selected) {
      if (selection) setSelection(null);
    } else if (updatedDraft && updatedDraft !== selected.draft) {
      setSelection({ ...selected, draft: updatedDraft });
    }
  }, [selected, selection, updatedDraft]);

  const select = React.useCallback(
    (command: ResolvedSlashCommand, args: string) => {
      if (
        command.kind !== 'prompt_workflow' ||
        !('template' in command.action) ||
        command.availability?.disabled
      )
        return false;
      const action = command.action;
      // Invocation templates contain the command prefix. The server expands it on send.
      const template =
        action.type === 'insert_invocation' &&
        !/\{\{\s*args\s*\}\}/.test(action.template)
          ? action.template.trimEnd() + ' {{args}}'
          : action.template;
      const next = createPromptDraft(template, args);
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
  function selectStarter(prompt: string) {
    const invocation = parseSlashCommandInvocation(prompt);
    const workflow =
      invocation && commands.find((item) => item.name === invocation.name);
    if (workflow && select(workflow, invocation.args)) return;

    setSelection(null);
    setBrowsingPrompts(false);
    setText(prompt);
    focus(prompt.length);
  }

  return {
    commands: commands.filter(({ action }) =>
      action.type === 'insert_text' ||
      ('template' in action && hasRuntimeCapabilitySelection(getActionRuntimeCapabilities(action))),
    ),
    selectStarter,
    selected: current,
    shortcutCommand:
      !browsingPrompts && current?.command.workflow?.scenarios?.length
        ? current.command
        : null,
    select,
    selectShortcut,
    showPrompts: () => setBrowsingPrompts(true),
    chooseScenario,
    commandSource: command
      ? getSlashCommandSource(command, i18n.language)
      : undefined,
    runtimeCapabilities: current?.runtimeCapabilities ?? null,
    removeCapability,
    clear: () => setSelection(null),
    restore: (previous: Selection | null) =>
      setSelection((existing) => existing ?? previous),
  };
}
