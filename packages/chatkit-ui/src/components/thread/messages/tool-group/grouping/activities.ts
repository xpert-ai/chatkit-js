import {
  isToolActivity,
  summarizeToolActivities,
  type TMessageContentComponent,
} from '@xpert-ai/chatkit-types';
import { getToolStepData } from '../status/step-status';

export function toolExecutionScope(item: TMessageContentComponent) {
  return JSON.stringify([
    item.executionId ?? '',
    item.agentKey ?? '',
    item.parentExecutionId ?? '',
  ]);
}

export function toolCallIdentity(item: TMessageContentComponent) {
  return `${toolExecutionScope(item)}:${item.id}`;
}

export function distinctToolCalls(items: TMessageContentComponent[]) {
  const calls = new Map<string, TMessageContentComponent>();
  for (const item of items) {
    const key = toolCallIdentity(item);
    const previous = calls.get(key);
    if (!previous) {
      calls.set(key, item);
      continue;
    }
    const before = getToolStepData(previous);
    const after = getToolStepData(item);
    calls.set(key, {
      ...previous,
      ...item,
      data: {
        ...before,
        ...after,
        category: item.data.category,
        ...(before.presentation
          ? {
              presentation: {
                ...before.presentation,
                ...after.presentation,
                activity: before.presentation.activity,
              },
            }
          : {}),
      },
    });
  }
  return [...calls.values()];
}

export function toolGroupActivity(items: TMessageContentComponent[]) {
  return summarizeToolActivities(
    items.map((item) => {
      const activity = getToolStepData(item).presentation?.activity;
      return isToolActivity(activity) ? activity : undefined;
    }),
  );
}

export function toolGroupActivityTitle(
  activity: ReturnType<typeof toolGroupActivity>,
  t: (key: string, values?: { first: string; second: string }) => string,
) {
  const prefix = 'message.toolGroup.activity';
  if (!activity.kinds.length) return t(`${prefix}.unknown`);
  if (activity.kind)
    return t(
      activity.action
        ? `${prefix}.actions.${activity.kind}.${activity.action}`
        : `${prefix}.kinds.${activity.kind}`,
    );
  if (activity.kinds.length + Number(activity.unknown) > 2)
    return t(`${prefix}.mixed`);
  return t(`${prefix}.combine`, {
    first: t(`${prefix}.kinds.${activity.kinds[0]}`),
    second: activity.unknown
      ? t(`${prefix}.other`)
      : t(`${prefix}.kinds.${activity.kinds[1]}`),
  });
}
