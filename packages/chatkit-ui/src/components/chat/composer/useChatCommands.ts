import * as React from 'react';
import {
  getComposerEditingLength,
  setComposerSelectionOffset,
} from '../../../lib/composer-parts';
import { normalizeReferences } from '../../../lib/references';
import type { useStreamContext } from '../../../providers/Stream';
import type { useChatFiles } from '../files/useChatFiles';
import type { useChatGoal } from '../goal/useChatGoal';
import type { useChatHost } from '../host/useChatHost';
import type { useChatPetSettings } from '../pet/useChatPetSettings';
import {
  getRuntimeCapabilityPaletteEmptyLabelKey,
  type useRuntimeCapabilitiesState,
} from '../runtime-capabilities';
import type { useChatEnvironment } from '../session/useChatEnvironment';
import { useSlashCommands } from '../useSlashCommands';
import type { useChatCapabilities } from './useChatCapabilities';
import type { useChatDraft } from './useChatDraft';
import type { useChatSubmission } from './useChatSubmission';

type ChatCommandsOptions = Pick<
  ReturnType<typeof useChatEnvironment>,
  'composer' | 't' | 'stream'
> &
  Pick<
    ReturnType<typeof useRuntimeCapabilitiesState>,
    | 'runtimeCapabilities'
    | 'runtimeCapabilitiesReady'
    | 'runtimeCapabilityOptions'
    | 'runRuntimeCapabilities'
    | 'runtimeCapabilityPalette'
    | 'setRuntimeCapabilityPalette'
    | 'addRunRuntimeCapabilities'
    | 'setRunRuntimeCapabilities'
  > &
  Pick<
    ReturnType<typeof useChatDraft>,
    | 'draft'
    | 'composerPartsRef'
    | 'setComposerText'
    | 'focusComposerAt'
    | 'composerInputRef'
  > &
  Pick<ReturnType<typeof useChatHost>, 'parentMessenger'> &
  Pick<
    ReturnType<typeof useChatGoal>,
    'setIsGoalPanelOpen' | 'handleGoalCommand' | 'submitGoalModeDraft'
  > &
  Pick<
    ReturnType<typeof useChatPetSettings>,
    'handlePetCommand' | 'petDisabled'
  > &
  Pick<
    ReturnType<typeof useChatCapabilities>,
    'insertComposerCapabilityToken' | 'promptWorkflow'
  > &
  Pick<ReturnType<typeof useChatSubmission>, 'submitDraft'> &
  Pick<ReturnType<typeof useChatFiles>, 'setReferences'> & {
    setPlanModeEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    pendingFollowUps: ReturnType<typeof useStreamContext>['pendingFollowUps'];
  };

export function useChatCommands({
  composer,
  runtimeCapabilities,
  runtimeCapabilitiesReady,
  runtimeCapabilityOptions,
  runRuntimeCapabilities,
  draft,
  runtimeCapabilityPalette,
  setRuntimeCapabilityPalette,
  parentMessenger,
  composerPartsRef,
  setComposerText,
  focusComposerAt,
  setPlanModeEnabled,
  setIsGoalPanelOpen,
  handlePetCommand,
  petDisabled,
  handleGoalCommand,
  addRunRuntimeCapabilities,
  setRunRuntimeCapabilities,
  insertComposerCapabilityToken,
  submitDraft,
  promptWorkflow,
  t,
  submitGoalModeDraft,
  pendingFollowUps,
  stream,
  setReferences,
  composerInputRef,
}: ChatCommandsOptions) {
  const slashPaletteRef = React.useRef<HTMLDivElement>(null);
  const slashPaletteOptionRefs = React.useRef<Array<HTMLButtonElement | null>>(
    [],
  );

  const {
    slashPaletteOptions,
    executeSlashCommandFromDraft,
    selectSlashPaletteOption,
  } = useSlashCommands({
    hostCommands: composer?.slashCommands,
    runtimeCapabilities,
    runtimeCapabilitiesReady,
    runtimeCapabilityOptions,
    recommendedRuntimeCapabilities: runRuntimeCapabilities,
    draft,
    palette: runtimeCapabilityPalette,
    setPalette: setRuntimeCapabilityPalette,
    parentMessenger,
    getComposerEditingLength: () =>
      getComposerEditingLength(composerPartsRef.current),
    setComposerText,
    focusComposerAt,
    setPlanModeEnabled,
    setGoalPanelOpen: setIsGoalPanelOpen,
    onPetCommand: handlePetCommand,
    petDisabled,
    onGoalCommand: handleGoalCommand,
    addRunRuntimeCapabilities,
    setRunRuntimeCapabilities,
    insertComposerCapabilityToken,
    submitPrompt: submitDraft,
    onSelectPromptWorkflow: promptWorkflow.select,
    isPromptDraftActive: !!promptWorkflow.selected,
  });

  const slashPaletteEmptyLabel = runtimeCapabilityPalette
    ? t(
        getRuntimeCapabilityPaletteEmptyLabelKey(
          runtimeCapabilityPalette,
          runtimeCapabilitiesReady,
        ),
      )
    : t('composer.capabilities.emptySearch');

  const slashPaletteCapabilityEmptyLabels = runtimeCapabilitiesReady
    ? {
        skill: t('composer.slashCommands.empty.skills'),
        plugin: t('composer.slashCommands.empty.plugins'),
        subAgent: t('composer.slashCommands.empty.subAgents'),
      }
    : {
        skill: t('composer.slashCommands.empty.loadingCapabilities'),
        plugin: t('composer.slashCommands.empty.loadingCapabilities'),
        subAgent: t('composer.slashCommands.empty.loadingCapabilities'),
      };

  React.useEffect(() => {
    if (!runtimeCapabilityPalette) {
      return;
    }
    if (slashPaletteOptions.length === 0) {
      setRuntimeCapabilityPalette((previous) =>
        previous && previous.activeIndex !== 0
          ? { ...previous, activeIndex: 0 }
          : previous,
      );
      return;
    }
    if (runtimeCapabilityPalette.activeIndex >= slashPaletteOptions.length) {
      setRuntimeCapabilityPalette((previous) =>
        previous
          ? {
              ...previous,
              activeIndex: slashPaletteOptions.length - 1,
            }
          : previous,
      );
    }
  }, [
    runtimeCapabilityPalette,
    setRuntimeCapabilityPalette,
    slashPaletteOptions.length,
  ]);

  React.useLayoutEffect(() => {
    if (!runtimeCapabilityPalette) {
      return;
    }

    const container = slashPaletteRef.current;
    const option =
      slashPaletteOptionRefs.current[runtimeCapabilityPalette.activeIndex];
    if (!container || !option) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const optionRect = option.getBoundingClientRect();
    if (optionRect.top < containerRect.top) {
      container.scrollTop -= containerRect.top - optionRect.top;
    } else if (optionRect.bottom > containerRect.bottom) {
      container.scrollTop += optionRect.bottom - containerRect.bottom;
    }
  }, [runtimeCapabilityPalette, slashPaletteOptions.length]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (executeSlashCommandFromDraft()) {
      return;
    }
    if (submitGoalModeDraft()) {
      return;
    }
    submitDraft();
  };

  const handleEditPendingFollowUp = React.useCallback(
    (id: string) => {
      const item = pendingFollowUps.find(
        (entry) => entry.id === id && entry.mode === 'queue',
      );
      if (!item) {
        return;
      }

      const text = item.request?.input?.input?.trim() ?? '';
      const nextReferences = normalizeReferences(
        item.request?.input?.references,
      );
      stream.removePendingFollowUp(id);
      setComposerText(text);
      setReferences(nextReferences);

      requestAnimationFrame(() => {
        const input = composerInputRef.current;
        if (!input) {
          return;
        }

        input.focus();
        const position = text.length;
        setComposerSelectionOffset(input, position);
      });
    },
    [pendingFollowUps, setComposerText, stream],
  );
  return {
    slashPaletteOptions,
    selectSlashPaletteOption,
    executeSlashCommandFromDraft,
    handleEditPendingFollowUp,
    slashPaletteRef,
    slashPaletteOptionRefs,
    slashPaletteEmptyLabel,
    slashPaletteCapabilityEmptyLabels,
    handleSubmit,
  };
}
