/** HTTP 400 model selection contract shared with Xpert's TAssistantModelSelectionError. */
export type AssistantModelSelectionError = {
  statusCode: 400;
  error: 'Bad Request';
  code: 'ASSISTANT_MODEL_NOT_ALLOWED' | 'ASSISTANT_MODEL_UNAVAILABLE';
  modelId: string;
  message: string;
};
