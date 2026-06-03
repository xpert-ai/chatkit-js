import type { ChatKitSlashCommandAction } from '@xpert-ai/chatkit-types';

import { isRuntimeCapabilitiesSelection } from '../message-metadata';
import type { RuntimeCapabilitiesSelection } from '../runtime-capabilities';
import type { RuntimeCapabilitiesWithCommands } from './types';

type SlashCommandWithAction = {
  action: ChatKitSlashCommandAction;
};

export function getActionRuntimeCapabilities(
  action: ChatKitSlashCommandAction,
) {
  return 'runtimeCapabilities' in action &&
    isRuntimeCapabilitiesSelection(action.runtimeCapabilities)
    ? action.runtimeCapabilities
    : null;
}

function getSelectableRequiredIds(
  requiredIds: readonly string[],
  selectableIds: readonly string[],
) {
  const selectable = new Set(selectableIds);
  return requiredIds.filter((id) => selectable.has(id));
}

function hasSelectedRequiredIds(
  requiredIds: readonly string[],
  selectedIds?: readonly string[],
) {
  if (!requiredIds.length) {
    return true;
  }

  const selected = new Set(selectedIds ?? []);
  return requiredIds.every((id) => selected.has(id));
}

export function isSlashCommandRuntimeSelectionSatisfied(
  command: SlashCommandWithAction,
  runtimeCapabilities: RuntimeCapabilitiesWithCommands | null,
  selectedRuntimeCapabilities: RuntimeCapabilitiesSelection | null,
): boolean {
  const required = getActionRuntimeCapabilities(command.action);
  if (!required) {
    return true;
  }

  const requiredSkillIds = getSelectableRequiredIds(
    required.skills.ids,
    runtimeCapabilities?.skills.map((skill) => skill.id) ?? [],
  );
  const requiredPluginNodeKeys = getSelectableRequiredIds(
    required.plugins.nodeKeys,
    runtimeCapabilities?.plugins.map((plugin) => plugin.nodeKey) ?? [],
  );
  const requiredSubAgentNodeKeys = getSelectableRequiredIds(
    required.subAgents?.nodeKeys ?? [],
    runtimeCapabilities?.subAgents?.map((subAgent) => subAgent.nodeKey) ?? [],
  );

  return (
    hasSelectedRequiredIds(
      requiredSkillIds,
      selectedRuntimeCapabilities?.skills.ids,
    ) &&
    hasSelectedRequiredIds(
      requiredPluginNodeKeys,
      selectedRuntimeCapabilities?.plugins.nodeKeys,
    ) &&
    hasSelectedRequiredIds(
      requiredSubAgentNodeKeys,
      selectedRuntimeCapabilities?.subAgents?.nodeKeys,
    )
  );
}

export function hasSelectedRuntimeSlashCommand(
  runtimeCapabilities: RuntimeCapabilitiesWithCommands | null,
  selectedRuntimeCapabilities: RuntimeCapabilitiesSelection | null,
  commandName: string,
): boolean {
  return (
    runtimeCapabilities?.commands?.some(
      (command) =>
        command.name === commandName &&
        isSlashCommandRuntimeSelectionSatisfied(
          command,
          runtimeCapabilities,
          selectedRuntimeCapabilities,
        ),
    ) ?? false
  );
}
