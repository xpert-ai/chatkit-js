import type { ChatKitGoalAdapter } from '@xpert-ai/chatkit-types';

export const GOAL_RUN_INPUT = 'Continue working toward the active goal.';

export function isGoalAdapter(value: unknown): value is ChatKitGoalAdapter {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as Partial<ChatKitGoalAdapter>).getGoal === 'function' &&
    typeof (value as Partial<ChatKitGoalAdapter>).setGoal === 'function' &&
    typeof (value as Partial<ChatKitGoalAdapter>).updateGoal === 'function' &&
    typeof (value as Partial<ChatKitGoalAdapter>).clearGoal === 'function'
  );
}

export function formatGoalElapsed(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}
