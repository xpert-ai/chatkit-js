import type { TMessageContentComponent } from '@xpert-ai/chatkit-types';
import {
  CheckCircle2,
  CircleHelp,
  CircleSlash,
  Loader2,
  XCircle,
} from 'lucide-react';
import type { PartialStepData, StepStatus, ToolStepRunState } from '../types';
import { parseToolCallPresentation } from '../../../../../lib/tool-call-presentation';

export const toolStatusConfig = {
  unknown: { iconClass: 'text-muted-foreground', icon: CircleHelp },
  canceled: { iconClass: 'text-muted-foreground', icon: CircleSlash },
  success: {
    iconClass: 'text-muted-foreground',
    icon: CheckCircle2,
  },
  fail: {
    iconClass: 'text-destructive',
    icon: XCircle,
  },
  running: {
    iconClass: 'text-primary',
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

  if (category === data.category && data.presentation === undefined) {
    return data;
  }

  return {
    ...data,
    category,
    presentation: parseToolCallPresentation(data.presentation),
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
    return 'unknown';
  }

  return data.status ?? 'unknown';
}
