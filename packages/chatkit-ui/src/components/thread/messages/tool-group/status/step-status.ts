import type { TMessageContentComponent } from '@xpert-ai/chatkit-types';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { PartialStepData, StepStatus, ToolStepRunState } from '../types';

export const toolStatusConfig = {
  success: {
    iconClass: 'border-green-500 text-green-700',
    icon: CheckCircle2,
  },
  fail: {
    iconClass: 'border-red-500 text-red-700',
    icon: XCircle,
  },
  running: {
    iconClass: 'border-blue-500 text-blue-700',
    icon: Loader2,
  },
};

function normalizeStepCategory(category: unknown): string {
  if (typeof category !== 'string' || category.trim() === '') {
    return 'Tool';
  }

  return category;
}

export function getToolStepData(
  content: TMessageContentComponent,
): PartialStepData {
  const data = (content.data ?? {}) as PartialStepData;
  const category = normalizeStepCategory(data.category);

  if (category === data.category) {
    return data;
  }

  return {
    ...data,
    category,
  };
}

function isThreadKnownIdle(isThreadRunning: ToolStepRunState) {
  return isThreadRunning === false;
}

/** A paused run keeps its unfinished steps; only an idle run orphans them. */
export function isPausedToolStep(
  data: PartialStepData,
  isThreadPaused?: boolean,
) {
  return data.status === 'running' && isThreadPaused === true;
}

export function getEffectiveToolStepStatus(
  data: PartialStepData,
  isThreadRunning?: ToolStepRunState,
  isThreadPaused?: boolean,
): StepStatus | undefined {
  if (
    data.status === 'running' &&
    isThreadKnownIdle(isThreadRunning) &&
    !isPausedToolStep(data, isThreadPaused)
  ) {
    return 'fail';
  }

  return data.status;
}
