import type { TMessageContentComponent } from '@xpert-ai/chatkit-types';
import type { ToolStepRunState } from '../types';
import {
  getEffectiveToolStepStatus,
  getToolStepData,
  isPausedToolStep,
} from './step-status';

export function getToolGroupStatus(
  items: TMessageContentComponent[],
  isThreadRunning?: ToolStepRunState,
  isThreadPaused?: boolean,
) {
  let running = false;
  let paused = false;
  let failedCount = 0;
  let successCount = 0;
  let unknown = false;
  let canceled = false;
  for (const item of items) {
    const data = getToolStepData(item);
    const status = getEffectiveToolStepStatus(
      data,
      isThreadRunning,
      isThreadPaused,
    );
    if (status === 'fail' || Boolean(data.error)) failedCount++;
    else if (status === 'success') successCount++;
    if (!status || status === 'unknown') unknown = true;
    if (status === 'canceled') canceled = true;
    if (status === 'running') {
      if (isPausedToolStep(data, isThreadPaused)) paused = true;
      else running = true;
    }
  }
  return {
    status: running
      ? ('running' as const)
      : failedCount
        ? successCount
          ? ('partial' as const)
          : ('fail' as const)
        : unknown
          ? ('unknown' as const)
          : canceled
            ? ('canceled' as const)
            : paused
              ? ('paused' as const)
              : ('success' as const),
    paused: paused && !running,
    failedCount,
  };
}
