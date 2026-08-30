import type { ModelOption } from '@xpert-ai/chatkit-types';

export function resolveSelectedModelId(
  models: ModelOption[],
  requestedModelId?: string | null,
): string | null {
  const enabledModels = models.filter((model) => !model.disabled);
  if (enabledModels.length === 0) return null;

  if (
    requestedModelId &&
    enabledModels.some((model) => model.id === requestedModelId)
  ) {
    return requestedModelId;
  }

  return (
    enabledModels.find((model) => model.default)?.id ??
    enabledModels[0]?.id ??
    null
  );
}

export function normalizeModelOptions(models: ModelOption[]): ModelOption[] {
  const seen = new Set<string>();
  return models.flatMap((model) => {
    const { description, ...option } = model;
    const id = model.id.trim();
    const label = model.label.trim();
    if (!id || !label || seen.has(id)) return [];
    seen.add(id);
    return [
      {
        ...option,
        id,
        label,
        ...(description?.trim() ? { description: description.trim() } : {}),
      },
    ];
  });
}
