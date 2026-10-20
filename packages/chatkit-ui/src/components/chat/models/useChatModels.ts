import * as React from 'react';
import { getAssistantModelSelectionError } from '../../../lib/assistant-model-error';
import {
  normalizeModelOptions,
  resolveSelectedModelId,
} from '../../../lib/assistant-models';
import type { useChatHost } from '../host/useChatHost';
import { toError } from '../session/errors';
import type { useChatEnvironment } from '../session/useChatEnvironment';
import type { useChatModelState } from './useChatModelState';

type ChatModelsOptions = Pick<
  ReturnType<typeof useChatModelState>,
  | 'modelAssistantIdRef'
  | 'modelAssistantId'
  | 'requestedModelIdRef'
  | 'setAvailableModels'
  | 'setHostedModelCatalog'
  | 'setSelectedModelId'
  | 'selectedModelIdRef'
  | 'modelClient'
  | 'availableModels'
  | 'hostedModelCatalog'
> &
  Pick<
    ReturnType<typeof useChatEnvironment>,
    'composer' | 'missingConfig' | 'stream'
  > &
  Pick<ReturnType<typeof useChatHost>, 'sendParentEvent'>;

export function useChatModels({
  modelAssistantIdRef,
  modelAssistantId,
  requestedModelIdRef,
  composer,
  setAvailableModels,
  setHostedModelCatalog,
  setSelectedModelId,
  selectedModelIdRef,
  missingConfig,
  modelClient,
  sendParentEvent,
  availableModels,
  hostedModelCatalog,
  stream,
}: ChatModelsOptions) {
  const [catalogVersion, refreshCatalog] = React.useReducer(
    (version: number) => version + 1,
    0,
  );
  const [requiresModelSelection, setRequiresModelSelection] =
    React.useState(false);
  const requiresSelectionRef = React.useRef(false);
  const preferenceRequestRef = React.useRef(0);
  const scopeRef = React.useRef({ modelClient, modelAssistantId });
  scopeRef.current = { modelClient, modelAssistantId };
  const invalidateSelection = React.useCallback(() => {
    preferenceRequestRef.current += 1;
    requiresSelectionRef.current = true;
    setRequiresModelSelection(true);
    requestedModelIdRef.current = null;
    setSelectedModelId?.(null);
    refreshCatalog();
  }, [requestedModelIdRef, setSelectedModelId]);

  React.useEffect(() => {
    if (getAssistantModelSelectionError(stream.error)) invalidateSelection();
  }, [stream.error, invalidateSelection]);

  React.useEffect(() => {
    if (modelAssistantIdRef.current !== modelAssistantId) {
      modelAssistantIdRef.current = modelAssistantId;
      requestedModelIdRef.current = undefined;
      requiresSelectionRef.current = false;
      setRequiresModelSelection(false);
    }

    if (composer?.models !== undefined) {
      const models = normalizeModelOptions(composer.models);
      setAvailableModels(models);
      setHostedModelCatalog(null);
      setSelectedModelId?.(
        requiresSelectionRef.current
          ? null
          : resolveSelectedModelId(
              models,
              requestedModelIdRef.current === undefined
                ? selectedModelIdRef.current
                : requestedModelIdRef.current,
            ),
      );
      return;
    }

    setAvailableModels([]);
    setHostedModelCatalog(null);
    setSelectedModelId?.(null);
    if (missingConfig || !modelAssistantId) return;

    const assistants = modelClient.assistants;
    if (typeof assistants?.getModels !== 'function') return;

    const abortController = new AbortController();
    void assistants
      .getModels(modelAssistantId, { signal: abortController.signal })
      .then((response) => {
        if (abortController.signal.aborted) return;
        const models = normalizeModelOptions(response.models);
        setAvailableModels(models);
        setHostedModelCatalog({ ...response, models });
        const requestedModelId = requestedModelIdRef.current;
        setSelectedModelId?.(
          requiresSelectionRef.current
            ? null
            : requestedModelId === undefined
              ? response.selected_model_id
                ? resolveSelectedModelId(models, response.selected_model_id)
                : null
              : requestedModelId === null
                ? (models.find((model) => model.default && !model.disabled)
                    ?.id ?? null)
                : resolveSelectedModelId(models, requestedModelId),
        );
      })
      .catch((error) => {
        if (abortController.signal.aborted) return;
        if (
          error !== null &&
          typeof error === 'object' &&
          Reflect.get(error, 'status') === 404
        ) {
          return;
        }
        sendParentEvent?.('public_event', ['error', { error: toError(error) }]);
      });

    return () => abortController.abort();
  }, [
    composer?.models,
    missingConfig,
    modelAssistantId,
    modelClient,
    sendParentEvent,
    setSelectedModelId,
    modelAssistantIdRef,
    requestedModelIdRef,
    selectedModelIdRef,
    setAvailableModels,
    setHostedModelCatalog,
    catalogVersion,
  ]);

  const handleModelSelect = React.useCallback(
    (modelId: string) => {
      const nextModelId = availableModels.find(
        (model) => model.id === modelId && !model.disabled,
      )?.id;
      if (!nextModelId) return;

      const previousModelId = selectedModelIdRef.current;
      const previouslyRequiredSelection = requiresSelectionRef.current;
      const requestId = ++preferenceRequestRef.current;
      requestedModelIdRef.current = nextModelId;
      setSelectedModelId?.(nextModelId);
      requiresSelectionRef.current = false;
      setRequiresModelSelection(false);
      if (!hostedModelCatalog?.preference_persistable) return;

      const assistants = modelClient.assistants;
      if (typeof assistants?.setModelPreference !== 'function') return;

      void assistants
        .setModelPreference(modelAssistantId, nextModelId)
        .catch((error) => {
          if (
            requestId !== preferenceRequestRef.current ||
            scopeRef.current.modelClient !== modelClient ||
            scopeRef.current.modelAssistantId !== modelAssistantId
          )
            return;
          if (getAssistantModelSelectionError(error)) {
            invalidateSelection();
          } else {
            requestedModelIdRef.current = previousModelId;
            setSelectedModelId?.(previousModelId);
            requiresSelectionRef.current = previouslyRequiredSelection;
            setRequiresModelSelection(previouslyRequiredSelection);
          }
          sendParentEvent?.('public_event', [
            'error',
            { error: toError(error) },
          ]);
        });
    },
    [
      availableModels,
      hostedModelCatalog?.preference_persistable,
      modelAssistantId,
      modelClient,
      sendParentEvent,
      setSelectedModelId,
      selectedModelIdRef,
      requestedModelIdRef,
      invalidateSelection,
    ],
  );
  return { handleModelSelect, requiresModelSelection };
}
