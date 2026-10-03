import * as React from 'react';
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
  Pick<ReturnType<typeof useChatEnvironment>, 'composer' | 'missingConfig'> &
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
}: ChatModelsOptions) {
  React.useEffect(() => {
    if (modelAssistantIdRef.current !== modelAssistantId) {
      modelAssistantIdRef.current = modelAssistantId;
      requestedModelIdRef.current = undefined;
    }

    if (composer?.models !== undefined) {
      const models = normalizeModelOptions(composer.models);
      setAvailableModels(models);
      setHostedModelCatalog(null);
      setSelectedModelId?.(
        resolveSelectedModelId(
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
          requestedModelId === undefined
            ? response.selected_model_id
              ? resolveSelectedModelId(models, response.selected_model_id)
              : null
            : requestedModelId === null
              ? (models.find((model) => model.default && !model.disabled)?.id ??
                null)
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
  ]);

  const handleModelSelect = React.useCallback(
    (modelId: string) => {
      const nextModelId = resolveSelectedModelId(availableModels, modelId);
      if (!nextModelId) return;

      requestedModelIdRef.current = nextModelId;
      setSelectedModelId?.(nextModelId);
      if (!hostedModelCatalog?.preference_persistable) return;

      const assistants = modelClient.assistants;
      if (typeof assistants?.setModelPreference !== 'function') return;

      void assistants
        .setModelPreference(modelAssistantId, nextModelId)
        .catch((error) => {
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
    ],
  );
  return { handleModelSelect };
}
