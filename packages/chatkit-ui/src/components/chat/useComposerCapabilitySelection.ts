import * as React from 'react';
import {
  createRuntimeCapabilitiesForSubmit,
  getRuntimeCapabilityOptions,
  isRuntimeCapabilitySelected,
  mergeRuntimeCapabilitiesSelections,
  type RuntimeCapabilitiesSelection,
  type RuntimeCapabilityOption,
} from '../../lib/runtime-capabilities';
import {
  getComposerCapabilitySelectionKeys,
  getRuntimeCapabilityOptionKey,
  type ComposerPart,
} from '../../lib/composer-parts';
import type { RuntimeCapabilitiesWithCommands } from '../../lib/slash-commands';

export function useComposerCapabilitySelection({
  capabilities,
  session,
  run,
  prompt,
  parts,
  removeRun,
  removePrompt,
  toggleSession,
}: {
  capabilities: RuntimeCapabilitiesWithCommands | null;
  session: RuntimeCapabilitiesSelection | null;
  run: RuntimeCapabilitiesSelection;
  prompt: RuntimeCapabilitiesSelection | null;
  parts: ComposerPart[];
  removeRun: (option: RuntimeCapabilityOption) => void;
  removePrompt: (option: RuntimeCapabilityOption) => void;
  toggleSession: (
    type: RuntimeCapabilityOption['type'],
    id: string,
    selected: boolean,
  ) => void;
}) {
  // Use the same available/recommended composition as submission and the menu.
  const selection = React.useMemo(
    () =>
      capabilities
        ? createRuntimeCapabilitiesForSubmit({
            capabilities,
            available: session,
            recommended: mergeRuntimeCapabilitiesSelections(
              capabilities,
              run,
              prompt,
            ),
          })
        : null,
    [capabilities, session, run, prompt],
  );
  const options = React.useMemo(
    () => getRuntimeCapabilityOptions(capabilities),
    [capabilities],
  );
  const selectedOptions = options.filter(
    (option) =>
      selection &&
      isRuntimeCapabilitySelected(selection, option.type, option.id),
  );
  const tokenKeys = getComposerCapabilitySelectionKeys(parts);

  const removeFromSessionAndPrompt = React.useCallback(
    (option: RuntimeCapabilityOption) => {
      if (
        session &&
        isRuntimeCapabilitySelected(session, option.type, option.id)
      ) {
        toggleSession(option.type, option.id, false);
      }
      removePrompt(option);
    },
    [session, toggleSession, removePrompt],
  );
  const remove = React.useCallback(
    (option: RuntimeCapabilityOption) => {
      removeRun(option);
      removeFromSessionAndPrompt(option);
    },
    [removeRun, removeFromSessionAndPrompt],
  );
  const toggle = React.useCallback(
    (type: RuntimeCapabilityOption['type'], id: string, selected: boolean) => {
      const option = options.find(
        (item) => item.type === type && item.id === id,
      );
      if (!selected && option) remove(option);
      else toggleSession(type, id, selected);
    },
    [options, remove, toggleSession],
  );

  return {
    selection,
    inline: selectedOptions.filter(
      (option) =>
        option.type !== 'subAgent' &&
        !tokenKeys.has(getRuntimeCapabilityOptionKey(option)),
    ),
    subAgents: selectedOptions.filter((option) => option.type === 'subAgent'),
    remove,
    toggle,
    removeFromSessionAndPrompt,
  };
}
