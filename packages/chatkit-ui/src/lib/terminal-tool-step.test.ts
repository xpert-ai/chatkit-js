import { describe, expect, it } from 'vitest';
import type {
  TMessageContentComponent,
  TChatEventMessage,
} from '@xpert-ai/chatkit-types';
import { buildAssistantRenderTree } from './agent-run-render-tree';
import { resolveTerminalToolStep } from './terminal-tool-step';

const step: TMessageContentComponent<TChatEventMessage> = {
  id: 'tool',
  type: 'component',
  executionId: 'child',
  data: {
    category: 'Tool',
    status: 'running',
    created_date: '2026-11-21T11:24:18.977Z',
  },
};
const run = {
  id: 'child',
  parentId: 'root',
  status: 'error',
  createdAt: '2026-11-21T11:10:02.997Z',
  elapsedTime: 859159,
  updatedAt: '2026-11-21T11:24:22.233Z',
};

describe('tool display after its own execution ends', () => {
  it('uses the measured execution end while another turn is running, without changing persisted events', () => {
    const tree = buildAssistantRenderTree({
      id: 'reply',
      type: 'assistant',
      status: 'success',
      executionId: 'root',
      agentRuns: [run, { id: 'new-run', status: 'running' }],
      content: [step],
    });
    const node = tree.units.find(
      (unit) => unit.type === 'agent' && unit.node.id === 'child',
    );
    expect(node?.type === 'agent' && node.node.entries[0].item).toMatchObject({
      data: { status: 'fail', end_date: '2026-11-21T11:24:22.156Z' },
    });
    expect(step.data.status).toBe('running');
    expect(step.data.end_date).toBeUndefined();
  });
  it.each(['running', 'pending', 'paused', 'waiting'])(
    'keeps %s runs unchanged',
    (status) => {
      expect(resolveTerminalToolStep(step, { ...run, status })).toBe(step);
    },
  );
  it('does not infer tool success from a successful parent or invent a timestamp', () => {
    expect(
      resolveTerminalToolStep(step, { id: 'child', status: 'success' }),
    ).toMatchObject({ data: { status: 'fail' } });
    expect(
      resolveTerminalToolStep(step, { id: 'child', status: 'success' }),
    ).not.toHaveProperty('data.end_date');
  });
  it('preserves explicit tool completion and finished tool results', () => {
    const done = {
      ...step,
      data: { ...step.data, status: 'success' as const },
    };
    expect(resolveTerminalToolStep(done, run)).toBe(done);
    expect(
      resolveTerminalToolStep(
        {
          ...step,
          data: { ...step.data, end_date: '2026-11-21T11:24:20.000Z' },
        },
        run,
      ),
    ).toHaveProperty('data.end_date', '2026-11-21T11:24:20.000Z');
  });
});
