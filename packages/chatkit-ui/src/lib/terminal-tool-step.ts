import type { TMessageContentComplex } from '@xpert-ai/chatkit-types';
import type { AgentRunInfo } from './agent-runs';

function timestamp(value: unknown) {
  const parsed =
    value instanceof Date
      ? value.getTime()
      : typeof value === 'string'
        ? Date.parse(value)
        : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Render an unfinished step against its own execution, never the next turn.
 * Missing tool completion is not success. Keep the stored event unchanged.
 */
export function resolveTerminalToolStep(
  item: TMessageContentComplex | string,
  run?: AgentRunInfo,
): TMessageContentComplex | string {
  if (
    !run ||
    ![
      'success',
      'succeeded',
      'completed',
      'error',
      'failed',
      'interrupted',
      'canceled',
      'cancelled',
    ].includes(run.status ?? '') ||
    typeof item === 'string' ||
    item.type !== 'component' ||
    item.data.category !== 'Tool' ||
    !('status' in item.data) ||
    item.data.status !== 'running'
  )
    return item;

  const start = timestamp(run.startedAt) ?? timestamp(run.createdAt);
  const measuredEnd =
    start !== undefined &&
    typeof run.elapsedTime === 'number' &&
    Number.isFinite(run.elapsedTime) &&
    run.elapsedTime >= 0
      ? start + run.elapsedTime
      : undefined;
  const end = timestamp(run.endedAt) ?? measuredEnd ?? timestamp(run.updatedAt);
  return {
    ...item,
    data: {
      ...item.data,
      status: 'fail',
      ...((!('end_date' in item.data) ||
        timestamp(item.data.end_date) === undefined) &&
      end !== undefined
        ? { end_date: new Date(end).toISOString() }
        : {}),
    },
  };
}
