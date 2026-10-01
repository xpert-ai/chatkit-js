import type { PendingFollowUp } from '../../../lib/follow-ups';

export function mergePendingFollowUps(
  existingItems: PendingFollowUp[],
  nextItems: PendingFollowUp[],
): PendingFollowUp[] {
  if (nextItems.length === 0) {
    return existingItems;
  }

  const itemsById = new Map<string, PendingFollowUp>();
  for (const item of existingItems) {
    itemsById.set(item.id, item);
  }
  for (const item of nextItems) {
    const existingItem = itemsById.get(item.id);
    if (existingItem?.queuedFromSteer) {
      itemsById.set(item.id, {
        ...item,
        request: {
          ...item.request,
          ...(existingItem.request.executionId
            ? { executionId: existingItem.request.executionId }
            : {}),
          followUpMode: item.mode,
        },
        targetExecutionId:
          existingItem.targetExecutionId ?? item.targetExecutionId,
        queuedFromSteer: true,
      });
      continue;
    }

    itemsById.set(item.id, item);
  }

  return [...itemsById.values()].sort((a, b) => a.createdAt - b.createdAt);
}
