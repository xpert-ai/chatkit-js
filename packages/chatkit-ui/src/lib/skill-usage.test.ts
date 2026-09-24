import { describe, expect, it } from 'vitest';
import {
  getMessageSkillUsages,
  normalizeChatSkillUsages,
  type ChatSkillUsage,
} from '@xpert-ai/chatkit-types';
import { normalizeTaskSummaryContribution } from './task-summary';

const usage: ChatSkillUsage = {
  skillId: 'research',
  name: 'Research',
  version: '1',
  source: { type: 'workspace', id: 'workspace-1' },
  activation: 'read',
  toolCallId: 'call-1',
  executionId: 'run-1',
  loadedAt: '2026-09-23T00:00:00.000Z',
};
const component = (usages: ChatSkillUsage[], status = 'success') => ({
  type: 'component',
  data: { status, taskSummary: { version: 1, skillUsages: usages } },
});

describe('message skill observations', () => {
  it('merges every component, deduplicates reads and survives persisted summary reload', () => {
    const second = {
      ...usage,
      skillId: 'writing',
      name: 'Writing',
      toolCallId: 'call-2',
    };
    const content = [
      component([usage]),
      component([second]),
      component([{ ...usage, toolCallId: 'call-3' }]),
    ];
    expect(getMessageSkillUsages({ content })).toEqual([usage, second]);
    const taskSummary = normalizeTaskSummaryContribution(
      JSON.parse(
        JSON.stringify({
          version: 1,
          skillUsages: [usage, second],
        }),
      ),
    );
    expect(getMessageSkillUsages({ content, taskSummary })).toEqual([
      usage,
      second,
    ]);
    expect(getMessageSkillUsages({ content: 'Later response' })).toEqual([]);
  });

  it('does not collapse identically named skills from different sources or versions', () => {
    const other = {
      ...usage,
      source: { type: 'project' as const, id: 'project-1' },
    };
    expect(
      getMessageSkillUsages({
        content: [component([usage, other, { ...usage, version: '2' }])],
      }),
    ).toHaveLength(3);
  });

  it('ignores failed, pending, selected-only, legacy and malformed data', () => {
    expect(
      getMessageSkillUsages({
        content: [component([usage], 'fail'), component([usage], 'running')],
      }),
    ).toEqual([]);
    expect(
      getMessageSkillUsages({
        content: [{ type: 'text', text: 'I used Research' }],
      }),
    ).toEqual([]);
    expect(
      normalizeChatSkillUsages([
        { ...usage, activation: 'selected' },
        { ...usage, loadedAt: 'bad' },
        { ...usage, source: { type: 'personal', id: 'user' } },
        null,
        'Research',
      ]),
    ).toEqual([]);
    expect(
      normalizeTaskSummaryContribution({ version: 1, sources: [] }),
    ).toEqual({ version: 1, fileChanges: [] });
  });

  it('allowlists public metadata and does not expose paths or raw output', () => {
    expect(
      normalizeChatSkillUsages([
        {
          ...usage,
          path: '/secret/SKILL.md',
          output: 'secret',
          source: { ...usage.source, rootPath: '/secret' },
        },
      ]),
    ).toEqual([usage]);
  });
});
