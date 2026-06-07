import { describe, expect, it } from 'vitest';

import {
  applyThreadContextUsageEvent,
  extractThreadContextUsageEvent,
  isThreadContextUsageEvent,
  isThreadContextUsageRenderArtifact,
  parseThreadContextUsageEvent,
  resolveUsedContextSize,
  THREAD_CONTEXT_USAGE_EVENT_TYPE,
  upsertThreadContextUsage,
} from './thread-context-usage';
import type { TThreadContextUsageEvent } from '@xpert-ai/chatkit-types';

const usageEvent: TThreadContextUsageEvent = {
  type: THREAD_CONTEXT_USAGE_EVENT_TYPE,
  threadId: 'thread-1',
  agentKey: 'agent-1',
  runId: 'run-1',
  updatedAt: '2026-03-12T00:00:00.000Z',
  usage: {
    totalTokens: 120,
    contextTokens: 100,
    inputTokens: 90,
    outputTokens: 30,
    embedTokens: 0,
    totalPrice: 0,
    currency: 'USD',
  },
};

describe('thread context usage helpers', () => {
  it('parses a valid thread context usage event', () => {
    const parsed = parseThreadContextUsageEvent({
      ...usageEvent,
      usage: {
        ...usageEvent.usage,
        totalTokens: '120',
      },
    });

    expect(parsed).toEqual(usageEvent);
    expect(isThreadContextUsageEvent(parsed)).toBe(true);
  });

  it('extracts direct and wrapped thread context usage events', () => {
    expect(extractThreadContextUsageEvent(usageEvent)).toEqual(usageEvent);
    expect(
      extractThreadContextUsageEvent({
        id: 'agent-event-1',
        type: 'agent_event',
        event: THREAD_CONTEXT_USAGE_EVENT_TYPE,
        data: usageEvent,
      }),
    ).toEqual(usageEvent);
    expect(
      extractThreadContextUsageEvent({
        id: 'component-1',
        type: 'component',
        data: usageEvent,
      }),
    ).toEqual(usageEvent);
  });

  it('identifies usage events as internal render artifacts', () => {
    expect(isThreadContextUsageRenderArtifact(usageEvent)).toBe(true);
    expect(
      isThreadContextUsageRenderArtifact({
        id: 'agent-event-1',
        type: 'agent_event',
        event: THREAD_CONTEXT_USAGE_EVENT_TYPE,
      }),
    ).toBe(true);
    expect(
      isThreadContextUsageRenderArtifact({
        id: 'agent-event-2',
        type: 'agent_event',
        data: { type: THREAD_CONTEXT_USAGE_EVENT_TYPE },
      }),
    ).toBe(true);
    expect(
      isThreadContextUsageRenderArtifact({
        id: 'component-1',
        type: 'component',
        data: { type: THREAD_CONTEXT_USAGE_EVENT_TYPE },
      }),
    ).toBe(true);
    expect(
      isThreadContextUsageRenderArtifact({
        id: 'tool-1',
        type: 'component',
        data: {
          category: 'Tool',
          title: THREAD_CONTEXT_USAGE_EVENT_TYPE,
          message: THREAD_CONTEXT_USAGE_EVENT_TYPE,
        },
      }),
    ).toBe(false);
  });

  it('rejects invalid thread context usage payloads', () => {
    expect(parseThreadContextUsageEvent(null)).toBeNull();
    expect(
      parseThreadContextUsageEvent({
        type: 'thread_context_usage',
        threadId: 'thread-1',
        usage: { totalTokens: 120 },
      }),
    ).toBeNull();
    expect(
      parseThreadContextUsageEvent({
        type: 'thread_context_usage',
        threadId: 'thread-1',
        agentKey: 'agent-1',
        usage: { totalTokens: -1 },
      }),
    ).toBeNull();
  });

  it('upserts usage by agent key and ignores stale events from other threads', () => {
    const state = upsertThreadContextUsage({}, usageEvent);
    expect(state).toEqual({ [usageEvent.agentKey]: usageEvent });

    const nextEvent: TThreadContextUsageEvent = {
      ...usageEvent,
      usage: {
        ...usageEvent.usage,
        totalTokens: 160,
      },
    };
    expect(
      applyThreadContextUsageEvent(state, nextEvent, usageEvent.threadId),
    ).toEqual({ [usageEvent.agentKey]: nextEvent });

    expect(
      applyThreadContextUsageEvent(state, nextEvent, 'thread-2'),
    ).toBe(state);
  });

  it('prefers realtime tokens over fallback values', () => {
    expect(
      resolveUsedContextSize({
        realtimeUsage: usageEvent,
        fallbackUsedTokens: 80,
      }),
    ).toBe(120);

    expect(
      resolveUsedContextSize({
        fallbackUsedTokens: '80',
      }),
    ).toBe(80);
  });
});
