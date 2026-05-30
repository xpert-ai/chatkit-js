import * as React from 'react';
import type {
  ChatKitCommandSource,
  ChatKitOptions,
} from '@xpert-ai/chatkit-types';

import {
  toggleRuntimeCapabilitySelection,
  type RuntimeCapabilitiesSelection,
  type RuntimeCapabilityOption,
} from '../../lib/runtime-capabilities';
import type { ParentMessenger } from '../../providers/ParentMessenger';
import {
  createSlashCommandExecutionEffect,
  createSlashPaletteOptions,
  parseSlashCommandInvocation,
  resolveSlashCommands,
  shouldSubmitRawSlashInvocation,
  type ResolvedSlashCommand,
  type RuntimeCapabilitiesWithCommands,
  type RuntimeCapabilityPaletteState,
  type SlashPaletteOption,
} from '../../lib/slash-commands';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

type SubmitSlashPromptOptions = {
  inputText: string;
  displayText: string;
  commandSource: ChatKitCommandSource;
  runtimeCapabilities?: RuntimeCapabilitiesSelection;
  planMode?: boolean;
};

type GoalCommandOptions = {
  args: string;
  commandSource: ChatKitCommandSource;
  runtimeCapabilities?: RuntimeCapabilitiesSelection;
};

type ComposerReplaceRange = { start: number; end: number };

const BUILTIN_SLASH_COMMAND_I18N_KEYS: Record<
  string,
  {
    label: string;
    description: string;
    argsHint?: string;
  }
> = {
  plan: {
    label: 'composer.slashCommands.commands.plan.label',
    description: 'composer.slashCommands.commands.plan.description',
    argsHint: 'composer.slashCommands.commands.plan.argsHint',
  },
  skills: {
    label: 'composer.slashCommands.commands.skills.label',
    description: 'composer.slashCommands.commands.skills.description',
  },
  plugins: {
    label: 'composer.slashCommands.commands.plugins.label',
    description: 'composer.slashCommands.commands.plugins.description',
  },
  subagents: {
    label: 'composer.slashCommands.commands.subagents.label',
    description: 'composer.slashCommands.commands.subagents.description',
  },
  pet: {
    label: 'composer.slashCommands.commands.pet.label',
    description: 'composer.slashCommands.commands.pet.description',
    argsHint: 'composer.slashCommands.commands.pet.argsHint',
  },
};

export function useSlashCommands({
  hostCommands,
  runtimeCapabilities,
  runtimeCapabilitiesReady,
  runtimeCapabilityOptions,
  recommendedRuntimeCapabilities,
  draft,
  palette,
  setPalette,
  parentMessenger,
  getComposerEditingLength,
  setComposerText,
  focusComposerAt,
  setPlanModeEnabled,
  setGoalPanelOpen,
  onPetCommand,
  onGoalCommand,
  addRunRuntimeCapabilities,
  setRunRuntimeCapabilities,
  insertComposerCapabilityToken,
  submitPrompt,
}: {
  hostCommands?: NonNullable<ChatKitOptions['composer']>['slashCommands'];
  runtimeCapabilities: RuntimeCapabilitiesWithCommands | null;
  runtimeCapabilitiesReady: boolean;
  runtimeCapabilityOptions: RuntimeCapabilityOption[];
  recommendedRuntimeCapabilities: RuntimeCapabilitiesSelection | null;
  draft: string;
  palette: RuntimeCapabilityPaletteState | null;
  setPalette: React.Dispatch<
    React.SetStateAction<RuntimeCapabilityPaletteState | null>
  >;
  parentMessenger?: ParentMessenger | null;
  getComposerEditingLength: () => number;
  setComposerText: (text: string, caretOffset?: number) => void;
  focusComposerAt: (offset: number) => void;
  setPlanModeEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setGoalPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onPetCommand?: (mode: 'toggle' | 'on' | 'off' | 'settings') => void;
  onGoalCommand?: (options: GoalCommandOptions) => void | Promise<void>;
  addRunRuntimeCapabilities: (selection: RuntimeCapabilitiesSelection) => void;
  setRunRuntimeCapabilities: React.Dispatch<
    React.SetStateAction<RuntimeCapabilitiesSelection>
  >;
  insertComposerCapabilityToken: (
    capability: RuntimeCapabilityOption,
    range?: ComposerReplaceRange,
  ) => void;
  submitPrompt: (options: SubmitSlashPromptOptions) => void;
}) {
  const { t, i18n } = useChatkitTranslation();
  const resolvedCommands = React.useMemo(
    () => resolveSlashCommands(hostCommands, runtimeCapabilities?.commands),
    [hostCommands, runtimeCapabilities?.commands],
  );

  const localizedResolvedCommands = React.useMemo(
    () =>
      resolvedCommands.map((command) => {
        if (command.source !== 'builtin') {
          return command;
        }

        const keys = BUILTIN_SLASH_COMMAND_I18N_KEYS[command.name];
        if (!keys) {
          return command;
        }

        return {
          ...command,
          label: t(keys.label, { defaultValue: command.label }),
          description: command.description
            ? t(keys.description, { defaultValue: command.description })
            : command.description,
          argsHint:
            keys.argsHint && command.argsHint
              ? t(keys.argsHint, { defaultValue: command.argsHint })
              : command.argsHint,
        };
      }),
    [i18n.language, resolvedCommands, t],
  );

  const slashPaletteOptions = React.useMemo<SlashPaletteOption[]>(
    () =>
      createSlashPaletteOptions({
        palette,
        resolvedCommands: localizedResolvedCommands,
        runtimeCapabilitiesReady,
        runtimeCapabilityOptions,
        runtimeCapabilities,
        recommendedRuntimeCapabilities,
        language: i18n.language,
      }),
    [
      localizedResolvedCommands,
      i18n.language,
      palette,
      recommendedRuntimeCapabilities,
      runtimeCapabilities,
      runtimeCapabilitiesReady,
      runtimeCapabilityOptions,
    ],
  );

  const showPalette = React.useCallback(
    (capabilityTypes?: RuntimeCapabilityOption['type'][]) => {
      setComposerText('/', 1);
      setPalette({
        query: '',
        start: 0,
        end: 1,
        activeIndex: 0,
        atMessageStart: true,
        capabilityTypes,
      });
      focusComposerAt(1);
    },
    [focusComposerAt, setComposerText, setPalette],
  );

  const showCapabilityGroup = React.useCallback(
    (capabilityType: RuntimeCapabilityOption['type'], commandName: string) => {
      const text = `/${commandName}`;
      setComposerText(text, text.length);
      setPalette({
        query: commandName,
        start: 0,
        end: text.length,
        activeIndex: 0,
        atMessageStart: true,
        expandedCapabilityTypes: [capabilityType],
      });
      focusComposerAt(text.length);
    },
    [focusComposerAt, setComposerText, setPalette],
  );

  const toggleCapabilityGroup = React.useCallback(
    (capabilityType: RuntimeCapabilityOption['type']) => {
      if (!palette) {
        return;
      }

      setPalette((previous) => {
        if (!previous) {
          return previous;
        }

        const expandedCapabilityTypes = new Set(
          previous.expandedCapabilityTypes ?? [],
        );
        if (expandedCapabilityTypes.has(capabilityType)) {
          expandedCapabilityTypes.delete(capabilityType);
        } else {
          expandedCapabilityTypes.add(capabilityType);
        }

        return {
          ...previous,
          expandedCapabilityTypes: Array.from(expandedCapabilityTypes),
        };
      });
      focusComposerAt(palette.end);
    },
    [focusComposerAt, palette, setPalette],
  );

  const selectCapabilityById = React.useCallback(
    (
      capability: {
        type: RuntimeCapabilityOption['type'];
        id: string;
      },
      range?: ComposerReplaceRange,
    ) => {
      const option = runtimeCapabilityOptions.find(
        (item) => item.type === capability.type && item.id === capability.id,
      );
      if (option) {
        insertComposerCapabilityToken(option, range);
        return;
      }

      setRunRuntimeCapabilities((previous) =>
        toggleRuntimeCapabilitySelection(
          previous,
          capability.type,
          capability.id,
          true,
        ),
      );
      setComposerText('', 0);
      setPalette(null);
      focusComposerAt(0);
    },
    [
      focusComposerAt,
      insertComposerCapabilityToken,
      runtimeCapabilityOptions,
      setComposerText,
      setPalette,
      setRunRuntimeCapabilities,
    ],
  );

  const executeSlashCommand = React.useCallback(
    (command: ResolvedSlashCommand, args: string) => {
      const effect = createSlashCommandExecutionEffect(
        command,
        args,
        i18n.language,
      );

      if (effect.type === 'none') {
        return true;
      }

      if (effect.type === 'toggle_plan') {
        setPlanModeEnabled((enabled) => !enabled);
        if (effect.clearComposer) {
          setComposerText('', 0);
        }
        setPalette(null);
        focusComposerAt(0);
        return true;
      }

      if (effect.type === 'pet') {
        onPetCommand?.(effect.mode);
        if (effect.clearComposer) {
          setComposerText('', 0);
        }
        setPalette(null);
        focusComposerAt(0);
        return true;
      }

      if (effect.type === 'show_capabilities') {
        if (effect.capabilityTypes.length === 1) {
          showCapabilityGroup(effect.capabilityTypes[0], command.name);
          return true;
        }
        showPalette(effect.capabilityTypes);
        return true;
      }

      if (effect.type === 'select_capability') {
        selectCapabilityById(effect.capability, {
          start: 0,
          end: getComposerEditingLength(),
        });
        return true;
      }

      if (effect.type === 'set_composer_text') {
        if (effect.runtimeCapabilities) {
          addRunRuntimeCapabilities(effect.runtimeCapabilities);
        }
        setComposerText(effect.text, effect.caretOffset ?? effect.text.length);
        setPalette(null);
        focusComposerAt(effect.caretOffset ?? effect.text.length);
        return true;
      }

      if (effect.type === 'submit_prompt') {
        submitPrompt(effect);
        return true;
      }

      if (effect.type === 'goal') {
        void onGoalCommand?.({
          args: effect.args,
          commandSource: effect.commandSource,
          runtimeCapabilities: effect.runtimeCapabilities,
        });
        setComposerText('', 0);
        setPalette(null);
        focusComposerAt(0);
        return true;
      }

      if (effect.type === 'client_action') {
        if (parentMessenger) {
          void parentMessenger
            .sendCommand('onWidgetAction', {
              action: effect.action.action,
              widgetItem: {
                id: `slash-command:${effect.command.name}`,
                widget: {
                  type: 'slash_command',
                },
              },
            })
            .catch((error) => {
              console.warn('[Chat] Failed to run slash command action:', error);
            });
        }
        setComposerText('', 0);
        setPalette(null);
        focusComposerAt(0);
        return true;
      }

      return false;
    },
    [
      addRunRuntimeCapabilities,
      focusComposerAt,
      getComposerEditingLength,
      i18n.language,
      parentMessenger,
      onPetCommand,
      onGoalCommand,
      selectCapabilityById,
      setComposerText,
      setPalette,
      setPlanModeEnabled,
      showCapabilityGroup,
      showPalette,
      submitPrompt,
    ],
  );

  const selectSlashPaletteOption = React.useCallback(
    (option: SlashPaletteOption) => {
      if (!palette) {
        return;
      }

      if (option.kind === 'capability') {
        insertComposerCapabilityToken(option.capability, {
          start: palette.start,
          end: palette.end,
        });
        return;
      }

      if (option.capabilityType) {
        toggleCapabilityGroup(option.capabilityType);
        return;
      }

      if (
        option.command.name === 'goal' &&
        option.command.source === 'runtime'
      ) {
        setGoalPanelOpen((open) => !open);
        setComposerText('', 0);
        setPalette(null);
        focusComposerAt(0);
        return;
      }

      executeSlashCommand(option.command, '');
    },
    [
      executeSlashCommand,
      focusComposerAt,
      insertComposerCapabilityToken,
      palette,
      setGoalPanelOpen,
      setComposerText,
      setPalette,
      toggleCapabilityGroup,
    ],
  );

  const executeSlashCommandFromDraft = React.useCallback(() => {
    const invocation = parseSlashCommandInvocation(draft);
    if (!invocation) {
      return false;
    }

    const command = resolvedCommands.find(
      (item) => item.name === invocation.name,
    );
    if (!command) {
      return false;
    }
    if (shouldSubmitRawSlashInvocation(command)) {
      return false;
    }

    return executeSlashCommand(command, invocation.args);
  }, [draft, executeSlashCommand, resolvedCommands]);

  return {
    resolvedCommands: localizedResolvedCommands,
    slashPaletteOptions,
    executeSlashCommand,
    executeSlashCommandFromDraft,
    selectSlashPaletteOption,
  };
}
