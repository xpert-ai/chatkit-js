import * as React from 'react';
import {
  createComposerTextParts,
  getComposerEditingLength,
} from '../../../lib/composer-parts';
import {
  type useRuntimeCapabilitiesState,
  useRuntimeCapabilityComposerActions,
} from '../runtime-capabilities';
import type { useChatEnvironment } from '../session/useChatEnvironment';
import { useComposerCapabilitySelection } from '../useComposerCapabilitySelection';
import { usePromptWorkflowDraft } from '../usePromptWorkflowDraft';
import type { useChatDraft } from './useChatDraft';

type ChatCapabilitiesOptions = Pick<
  ReturnType<typeof useRuntimeCapabilitiesState>,
  | 'runtimeCapabilities'
  | 'runtimeCapabilitiesReady'
  | 'runtimeCapabilityOptions'
  | 'setRunRuntimeCapabilities'
  | 'setRuntimeCapabilityPalette'
  | 'applyExternalRuntimeCapabilities'
  | 'effectiveSessionRuntimeCapabilities'
  | 'runRuntimeCapabilities'
  | 'handleSessionRuntimeCapabilityToggle'
> &
  Pick<
    ReturnType<typeof useChatDraft>,
    | 'composerInputRef'
    | 'composerPartsRef'
    | 'commitComposerParts'
    | 'focusComposerAt'
    | 'draft'
    | 'composerParts'
    | 'onComposerCapabilityRemovedRef'
  > &
  Pick<
    ReturnType<typeof useChatEnvironment>,
    'stream' | 'activeProjectId' | 'composer'
  >;

export function useChatCapabilities({
  runtimeCapabilities,
  runtimeCapabilitiesReady,
  runtimeCapabilityOptions,
  setRunRuntimeCapabilities,
  setRuntimeCapabilityPalette,
  applyExternalRuntimeCapabilities,
  composerInputRef,
  composerPartsRef,
  commitComposerParts,
  focusComposerAt,
  draft,
  stream,
  activeProjectId,
  composer,
  effectiveSessionRuntimeCapabilities,
  runRuntimeCapabilities,
  composerParts,
  handleSessionRuntimeCapabilityToggle,
  onComposerCapabilityRemovedRef,
}: ChatCapabilitiesOptions) {
  const {
    applyComposerValueRuntimeCapabilities,
    updateRuntimeCapabilityPalette,
    removeRunRuntimeCapability,
    insertComposerCapabilityToken,
  } = useRuntimeCapabilityComposerActions({
    runtimeCapabilities,
    runtimeCapabilitiesReady,
    runtimeCapabilityOptions,
    setRunRuntimeCapabilities,
    setRuntimeCapabilityPalette,
    applyExternalRuntimeCapabilities,
    composerInputRef,
    composerPartsRef,
    commitComposerParts,
    focusComposerAt,
  });

  const setPromptComposerText = React.useCallback(
    (text: string, offset = text.length) => {
      const tokens = composerPartsRef.current.filter(
        (part) => part.type !== 'text',
      );
      commitComposerParts([...tokens, ...createComposerTextParts(text)], {
        caretOffset: getComposerEditingLength(tokens) + offset,
        resetDom: true,
        syncRemovedCapabilityTokens: false,
      });
    },
    [commitComposerParts],
  );

  const focusPromptComposer = React.useCallback(
    (offset: number) => {
      const tokens = composerPartsRef.current.filter(
        (part) => part.type !== 'text',
      );
      focusComposerAt(getComposerEditingLength(tokens) + offset);
    },
    [focusComposerAt],
  );

  const promptWorkflow = usePromptWorkflowDraft({
    draft,
    scope: JSON.stringify([
      stream.assistantId,
      activeProjectId,
      stream.threadId,
    ]),
    hostCommands: composer?.slashCommands,
    runtimeCommands: runtimeCapabilities?.commands,
    setText: setPromptComposerText,
    focus: focusPromptComposer,
  });

  const composerCapabilities = useComposerCapabilitySelection({
    capabilities: runtimeCapabilities,
    session: effectiveSessionRuntimeCapabilities,
    run: runRuntimeCapabilities,
    prompt: promptWorkflow.runtimeCapabilities,
    parts: composerParts,
    removeRun: removeRunRuntimeCapability,
    removePrompt: promptWorkflow.removeCapability,
    toggleSession: handleSessionRuntimeCapabilityToggle,
  });

  React.useEffect(() => {
    onComposerCapabilityRemovedRef.current =
      composerCapabilities.removeFromSessionAndPrompt;
  }, [composerCapabilities.removeFromSessionAndPrompt]);
  return {
    applyComposerValueRuntimeCapabilities,
    updateRuntimeCapabilityPalette,
    promptWorkflow,
    insertComposerCapabilityToken,
    composerCapabilities,
  };
}
