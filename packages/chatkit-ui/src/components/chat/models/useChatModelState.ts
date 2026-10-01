import type { ModelOption } from '@xpert-ai/chatkit-types';
import type { AssistantModelsResponse } from '@xpert-ai/xpert-sdk';
import * as React from 'react';
import type { useChatEnvironment } from '../session/useChatEnvironment';

type ChatModelStateOptions = Pick<
  ReturnType<typeof useChatEnvironment>,
  'stream'
>;

// Host commands can select a model before the hosted catalog has loaded.
// Keep selection state available before registering those command handlers.
export function useChatModelState({ stream }: ChatModelStateOptions) {
  const [availableModels, setAvailableModels] = React.useState<ModelOption[]>(
    [],
  );

  const [hostedModelCatalog, setHostedModelCatalog] =
    React.useState<AssistantModelsResponse | null>(null);

  const modelAssistantId = stream.assistantId;
  const modelClient = stream.client;
  const selectedModelId = stream.selectedModelId;
  const setSelectedModelId = stream.setSelectedModelId;
  const selectedModelIdRef = React.useRef(selectedModelId);

  selectedModelIdRef.current = selectedModelId;

  const requestedModelIdRef = React.useRef<string | null | undefined>(
    undefined,
  );

  const modelAssistantIdRef = React.useRef(modelAssistantId);
  return {
    requestedModelIdRef,
    setSelectedModelId,
    availableModels,
    modelAssistantIdRef,
    modelAssistantId,
    setAvailableModels,
    setHostedModelCatalog,
    selectedModelIdRef,
    modelClient,
    hostedModelCatalog,
  };
}
