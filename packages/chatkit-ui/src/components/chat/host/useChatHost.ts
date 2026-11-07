import {
  createComposerTextParts,
  getComposerEditingLength,
} from '../../../lib/composer-parts';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import * as React from 'react';
import { useParentMessenger } from '../../../hooks/useParentMessenger';
import { resolveSelectedModelId } from '../../../lib/assistant-models';
import {
  mergeReferences,
  normalizeReferences,
  type ComposerValuePayload,
} from '../../../lib/references';
import type { RuntimeCapabilitiesSelection } from '../../../lib/runtime-capabilities';
import { useInlineApproval } from '../../approvals/use-inline-approval';
import { isPetEnabled } from '../../pet/pet-local-settings';
import type { useChatCapabilities } from '../composer/useChatCapabilities';
import type { useChatDraft } from '../composer/useChatDraft';
import type { useChatFiles } from '../files/useChatFiles';
import type { useChatModelState } from '../models/useChatModelState';
import type { useChatPetSettings } from '../pet/useChatPetSettings';
import type { useRuntimeCapabilitiesState } from '../runtime-capabilities';
import type { useChatEnvironment } from '../session/useChatEnvironment';

type ChatHostOptions = Pick<
  ReturnType<typeof useChatDraft>,
  | 'setComposerText'
  | 'setSelectedTool'
  | 'composerInputRef'
  | 'composerPartsRef'
  | 'commitComposerParts'
> &
  Pick<
    ReturnType<typeof useChatFiles>,
    'setReferences' | 'setReferencedWorkspaceFiles'
  > &
  Pick<ReturnType<typeof useChatEnvironment>, 'composer' | 'stream'> &
  Pick<
    ReturnType<typeof useChatModelState>,
    'requestedModelIdRef' | 'setSelectedModelId' | 'availableModels'
  > &
  Pick<
    ReturnType<typeof useChatCapabilities>,
    'applyComposerValueRuntimeCapabilities'
  > &
  Pick<
    ReturnType<typeof useRuntimeCapabilitiesState>,
    'applyExternalRuntimeCapabilities'
  > &
  Pick<
    ReturnType<typeof useChatPetSettings>,
    'handleSetPetEnabled' | 'effectivePet'
  > & {
    canRespond: boolean;
    surface: 'main' | 'side';
    options: ChatKitOptions | null | undefined;
  };

export function useChatHost({
  canRespond,
  setComposerText,
  composerPartsRef,
  commitComposerParts,
  setReferences,
  setReferencedWorkspaceFiles,
  composer,
  setSelectedTool,
  requestedModelIdRef,
  setSelectedModelId,
  availableModels,
  applyComposerValueRuntimeCapabilities,
  applyExternalRuntimeCapabilities,
  composerInputRef,
  surface,
  handleSetPetEnabled,
  stream,
  options,
  effectivePet,
}: ChatHostOptions) {
  const handleSetComposerValue = React.useCallback(
    (payload: ComposerValuePayload | null) => {
      if (!payload) return;
      const shouldInsertRuntimeCapabilitiesBeforeText =
        typeof payload.text === 'string' &&
        payload.insertRuntimeCapabilities === true;

      if (typeof payload.text === 'string') {
        if (payload.appendText) {
          const previous = composerPartsRef.current;
          const parts = [
            ...previous,
            ...createComposerTextParts(
              `${previous.length ? '\n\n' : ''}${payload.text}`,
            ),
          ];
          commitComposerParts(parts, {
            caretOffset: getComposerEditingLength(parts),
            resetDom: true,
            syncRemovedCapabilityTokens: false,
          });
        } else setComposerText(payload.text);
      }
      if (payload.workspaceFiles) {
        setReferencedWorkspaceFiles((previous) => {
          const merged = new Map(
            previous.map((file) => [file.workspacePath ?? file.filePath, file]),
          );
          for (const file of payload.workspaceFiles ?? [])
            merged.set(file.path, {
              workspacePath: file.path,
              filePath: file.path,
              originalName: file.name,
              mimeType: file.mimeType,
              size: file.size,
              purpose: 'workspace',
            });
          return [...merged.values()];
        });
      }
      if (Array.isArray(payload.references)) {
        const nextReferences = normalizeReferences(payload.references);
        setReferences((previous) =>
          payload.appendReferences
            ? mergeReferences(previous, nextReferences)
            : nextReferences,
        );
      }
      if (payload.selectedToolId !== undefined) {
        const nextTool =
          payload.selectedToolId === null
            ? null
            : ((composer?.tools ?? []).find(
                (tool) => tool.id === payload.selectedToolId,
              ) ?? null);
        setSelectedTool(nextTool);
      }
      if (payload.selectedModelId !== undefined) {
        requestedModelIdRef.current = payload.selectedModelId;
        setSelectedModelId?.(
          availableModels.length
            ? resolveSelectedModelId(availableModels, payload.selectedModelId)
            : payload.selectedModelId,
        );
      }
      applyComposerValueRuntimeCapabilities(
        payload,
        shouldInsertRuntimeCapabilitiesBeforeText ? { insertAt: 0 } : undefined,
      );
    },
    [
      applyComposerValueRuntimeCapabilities,
      availableModels,
      composer?.tools,
      setComposerText,
      setSelectedModelId,
    ],
  );

  const handleSetRuntimeCapabilities = React.useCallback(
    (selection: RuntimeCapabilitiesSelection | null) => {
      applyExternalRuntimeCapabilities(selection);
    },
    [applyExternalRuntimeCapabilities],
  );

  const handleFocusComposer = React.useCallback(() => {
    composerInputRef.current?.focus();
  }, []);

  const parentMessenger = useParentMessenger(
    surface === 'main'
      ? {
          onSetComposerValue: handleSetComposerValue,
          onSetRuntimeCapabilities: handleSetRuntimeCapabilities,
          onFocusComposer: handleFocusComposer,
          onSetPetEnabled: handleSetPetEnabled,
        }
      : {},
  );

  const sendParentEvent = parentMessenger?.sendEvent;
  const inlineApproval = useInlineApproval({
    disabled: !canRespond,
    request: stream.pendingHITLRequest,
    options: options?.approvals,
    messenger: parentMessenger,
    submit: stream.submitHITLDecision,
    threadId: stream.threadId,
  });

  const canMinimizeToPet =
    parentMessenger?.isParentAvailable === true && isPetEnabled(effectivePet);

  const handleMinimizeToPet = React.useCallback(() => {
    parentMessenger?.sendEvent('chat_minimize_change', { minimized: true });
  }, [parentMessenger]);
  return {
    sendParentEvent,
    parentMessenger,
    canMinimizeToPet,
    handleMinimizeToPet,
    inlineApproval,
  };
}
