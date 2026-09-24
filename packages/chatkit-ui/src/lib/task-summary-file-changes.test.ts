import { describe, expect, it } from 'vitest';
import { mergeFileChanges, type ChatFileChange } from '@xpert-ai/chatkit-types';
import {
  collectLiveTaskSummary,
  mergeTaskSummary,
  type TaskSummarySnapshot,
} from './task-summary';

const a = { sha256: 'a'.repeat(64), size: 1 };
const b = { sha256: 'b'.repeat(64), size: 1 };
const create: ChatFileChange = {
  id: 'file-change:a.txt',
  title: 'a.txt',
  workspacePath: 'a.txt',
  operation: 'added',
  coverage: 'observed',
  before: null,
  after: a,
  startedAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
};
const remove: ChatFileChange = {
  ...create,
  operation: 'deleted',
  before: a,
  after: null,
  startedAt: '2026-09-02T00:00:00Z',
  updatedAt: '2026-09-02T00:00:00Z',
};

function snapshot(
  items: ChatFileChange[],
  total = items.length,
): TaskSummarySnapshot {
  return {
    version: 1,
    conversationId: 'conversation',
    threadId: 'thread',
    task: {},
    fileChanges: { items, total },
    outputs: { items: [], total: 0 },
    sources: { items: [], total: 0 },
    agents: { items: [], total: 0 },
    pending: { items: [], total: 0 },
    updatedAt: '2026-09-02T00:00:00Z',
  };
}
function live(changes: ChatFileChange[]) {
  return collectLiveTaskSummary({
    messages: changes.map((change, index) => ({
      id: `message-${index}`,
      taskSummary: { version: 1, fileChanges: [change] },
    })),
  });
}

describe('conversation file change baseline', () => {
  it.each([
    [create, remove],
    [
      { ...create, operation: 'modified' as const, before: a, after: b },
      { ...remove, operation: 'modified' as const, before: b, after: a },
    ],
  ])(
    'does not resurrect net-zero changes from a partial message page',
    (first, last) => {
      const net = mergeFileChanges([first, last]);
      expect(net).toEqual([]);
      const recentPage = live([last]);
      expect(recentPage.fileChanges).toHaveLength(1);
      const merged = mergeTaskSummary(snapshot(net), recentPage);
      expect(merged.fileChanges).toEqual([]);
      expect(merged.totals.fileChanges).toBe(0);
    },
  );

  it('refreshes from persisted changes without composing overlapping partial aggregates', () => {
    const baseline = snapshot([create]);
    expect(mergeTaskSummary(baseline, live([remove])).fileChanges).toEqual([
      create,
    ]);
    expect(mergeTaskSummary(snapshot([]), live([remove])).fileChanges).toEqual(
      [],
    );
    const next = {
      ...create,
      id: 'file-change:next.txt',
      workspacePath: 'next.txt',
      title: 'next.txt',
    };
    expect(
      mergeTaskSummary(snapshot([next]), live([remove, next])).fileChanges,
    ).toEqual([next]);
  });

  it('uses server section pages and totals without filling gaps from recent messages', () => {
    const items = Array.from({ length: 5 }, (_, index) => ({
      ...create,
      id: `change:${index}`,
      workspacePath: `file-${index}.txt`,
    }));
    const history = snapshot(items.slice(0, 3), 5);
    const recent = live([remove]);
    expect(mergeTaskSummary(history, recent).fileChanges).toEqual(
      items.slice(0, 3),
    );
    const expanded = mergeTaskSummary(history, recent, { fileChanges: items });
    expect(expanded.fileChanges).toEqual(items);
    expect(expanded.totals.fileChanges).toBe(5);
  });

  it('keeps local message projection available before history and for older servers', () => {
    const recent = live([create]);
    expect(mergeTaskSummary(null, recent).fileChanges).toEqual(
      recent.fileChanges,
    );
    const legacy = snapshot([]);
    delete legacy.fileChanges;
    expect(mergeTaskSummary(legacy, recent).fileChanges).toEqual(
      recent.fileChanges,
    );
  });
});
