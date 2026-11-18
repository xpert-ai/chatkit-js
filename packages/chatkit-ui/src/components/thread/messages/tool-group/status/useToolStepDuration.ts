import * as React from 'react';
import type { PartialStepData, StepStatus } from '../types';

function parseStepDate(value: unknown): number | null {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatStepDuration(durationMs: number): string {
  if (durationMs < 1_000) {
    return `${durationMs}ms`;
  }

  if (durationMs < 10_000) {
    return `${(durationMs / 1_000).toFixed(1)}s`;
  }

  if (durationMs < 60_000) {
    return `${Math.round(durationMs / 1_000)}s`;
  }

  const hours = Math.floor(durationMs / 3_600_000);
  const minutes = Math.floor((durationMs % 3_600_000) / 60_000);
  const seconds = Math.floor((durationMs % 60_000) / 1_000);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

export function useToolStepDurationLabel(
  data: PartialStepData,
  options?: {
    status?: StepStatus;
    isPaused?: boolean;
  },
) {
  const [durationNow, setDurationNow] = React.useState(() => Date.now());
  const createdAt = parseStepDate(data.created_date);
  const explicitEndedAt = parseStepDate(data.end_date);
  const status = options?.status ?? data.status;
  const isElapsing = status === 'running' && !options?.isPaused;
  const endedAt = explicitEndedAt;

  React.useEffect(() => {
    if (!isElapsing || createdAt === null || endedAt !== null) {
      return;
    }

    setDurationNow(Date.now());
    const timer = window.setInterval(() => {
      setDurationNow(Date.now());
    }, 100);

    return () => {
      window.clearInterval(timer);
    };
  }, [createdAt, endedAt, isElapsing]);

  // Historical terminal steps without a receipt time have unknown duration.
  // Mount time must never become a tool completion timestamp.
  if (createdAt === null || (!isElapsing && endedAt === null)) return null;

  const durationMs = Math.max(0, (endedAt ?? durationNow) - createdAt);
  return formatStepDuration(durationMs);
}
