import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  getMessageSkillUsages,
  isLegacySkillUsageComponent,
  type ChatSkillUsage,
} from '@xpert-ai/chatkit-types';
import { renderAssistant } from './ai.test-fixture';
import { buildToolComponentRenderUnits } from './tool-group/grouping/render-units';
import { isNonTranscriptMessageContent } from '../../../lib/message-content-presentation';

const usage: ChatSkillUsage = {
  skillId: 'live-dashboard',
  name: 'Live Dashboard',
  version: '1',
  source: { type: 'plugin', id: 'dashboard' },
  activation: 'read',
  toolCallId: 'read-1',
  loadedAt: '2026-11-26T00:00:00Z',
};
const summary = { version: 1 as const, skillUsages: [usage] };
const step = {
  id: 'read-1',
  type: 'component' as const,
  data: {
    category: 'Tool' as const,
    tool: 'read_skill_file',
    status: 'success' as const,
    toolPresentation: 'redacted' as const,
    taskSummary: summary,
  },
};
const legacy = {
  id: 'native:read-1',
  type: 'component' as const,
  data: {
    category: 'Computer' as const,
    tool: 'read_skill_file',
    status: 'success' as const,
    taskSummary: summary,
  },
};

describe('skill provenance in the transcript', () => {
  it.each([false, true])(
    'keeps one tool group and skill provenance across history reload (%s)',
    (historical) => {
      const content = JSON.parse(
        JSON.stringify([step, legacy, { ...step, id: 'read-2' }]),
      );
      renderAssistant(content, { historical });
      expect(screen.queryByText('Computer')).not.toBeInTheDocument();
      expect(buildToolComponentRenderUnits(content)).toMatchObject([
        { type: 'tool-group', items: [step, { ...step, id: 'read-2' }] },
      ]);
      expect(getMessageSkillUsages({ content })).toEqual([usage]);
      expect(getMessageSkillUsages({ content: [step] })).toEqual([usage]);
    },
  );

  it('hides only the validated legacy metadata envelope, never a normal read or actual result', () => {
    expect(isNonTranscriptMessageContent(legacy)).toBe(true);
    expect(isNonTranscriptMessageContent(step)).toBe(false);
    for (const extra of [
      { output: 'file contents' },
      { error: 'read failed' },
      { artifact: {} },
      { type: 'Widget', widgets: [] },
      { status: 'fail' },
      { taskSummary: { version: 1, skillUsages: [] } },
    ])
      expect(
        isLegacySkillUsageComponent({
          ...legacy,
          data: { ...legacy.data, ...extra },
        }),
      ).toBe(false);
  });

  it('preserves existing Computer search results', () => {
    const result = {
      id: 'search',
      type: 'component' as const,
      data: {
        category: 'Computer' as const,
        type: 'web_search',
        tool: 'web_search',
        status: 'success' as const,
        data: [
          {
            title: 'Source document',
            url: 'https://example.com/source',
            content: 'Evidence',
          },
        ],
      },
    };
    expect(isNonTranscriptMessageContent(result)).toBe(false);
    expect(buildToolComponentRenderUnits([result])[0]).toMatchObject({
      type: 'tool-group',
      items: [result],
    });
  });
});
