import { describe, expect, it } from 'vitest';
import { mergeFileChanges, projectMessageFileActivity, parseFileChangeReport, type ChatFileChange, type TChatTaskSummaryContribution } from '@xpert-ai/chatkit-types';
import { collectLiveTaskSummary } from './task-summary';
const hash = (letter: string) => letter.repeat(64);
const ref = (id: string) => ({ type: 'file_change' as const, first: { artifactId: id, artifactVersionId: id }, last: { artifactId: id, artifactVersionId: id } });
const change = (before: string | null, after: string | null, time: string): ChatFileChange => ({ id: 'file-change:report.json', workspacePath: 'report.json', title: 'report.json', operation: before ? after ? 'modified' : 'deleted' : 'added', coverage: 'observed', before: before ? { sha256: hash(before), size: 1 } : null, after: after ? { sha256: hash(after), size: 2 } : null, resource: ref(time), startedAt: time, updatedAt: time });

describe('file activity semantic projection', () => {
  it('removes proven legacy tool writes from outputs without extension filtering', () => {
    const summary: TChatTaskSummaryContribution = { version: 1, outputs: [{ id: 'workspace-file:spec.json', kind: 'file', title: 'spec.json', resource: { type: 'workspace_file', workspacePath: 'spec.json' } }, { id: 'explicit-json', kind: 'file', title: 'requested.json', resource: { type: 'artifact', artifactId: 'json', artifactVersionId: 'v1' }, origin: 'tool' }] };
    const content = [{ type: 'component', data: { tool: 'sandbox_write_file', status: 'success', input: { file_path: 'spec.json' } } }];
    const projected = projectMessageFileActivity({ id: 'm1', content, taskSummary: summary }, summary);
    expect(projected.outputs?.map((item) => item.title)).toEqual(['requested.json']);
    expect(projected.fileChanges).toEqual([expect.objectContaining({ workspacePath: 'spec.json', coverage: 'legacy', operation: 'unknown' })]);
    expect(collectLiveTaskSummary({ messages: [{ id: 'm1', content, taskSummary: summary }] }).outputs).toEqual(projected.outputs);
  });
  it('retains immutable versions and metadata through normalization and reload', () => {
    const taskSummary: TChatTaskSummaryContribution = { version: 1, outputs: [{ id: 'deliverable:final.xlsx', title: 'final.xlsx', kind: 'spreadsheet', origin: 'tool', resource: { type: 'artifact', artifactId: 'a', artifactVersionId: 'v1' }, workspacePath: 'final.xlsx', sha256: hash('a'), size: 2 }] };
    expect(collectLiveTaskSummary({ messages: [{ id: 'm1', taskSummary }] }).outputs[0]?.resource).toEqual(taskSummary.outputs?.[0]?.resource);
  });
  it('does not invent changes when an observed write failed or did nothing', () => {
    const content = [{ id: 'call1', type: 'component', data: { tool: 'sandbox_write_file', status: 'success', input: { file_path: 'report.json' } } }, { id: 'receipt', type: 'component', data: { _meta: { 'xpertai/taskSummary': { version: 1, fileActivityVersion: 1, fileActivityToolCallId: 'call1', fileChanges: [] } } } }];
    expect(projectMessageFileActivity({ content }, { version: 1 }).fileChanges).toEqual([]);
  });
  it('merges first-before and last-after, deduplicates replay and drops net no-ops', () => {
    const first = change(null, 'a', '2026-01-01'), last = change('a', 'b', '2026-01-02');
    const merged = mergeFileChanges([last, first, first]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ before: null, after: { sha256: hash('b') }, operation: 'added', resource: { first: first.resource?.first, last: last.resource?.last } });
    expect(mergeFileChanges([change('a', 'b', '1'), change('b', 'a', '2')])).toEqual([]);
    expect(mergeFileChanges([first, change('a', null, '2026-01-03')])).toEqual([]);
  });
  it('rejects invalid review payloads and oversized embedded text', () => {
    expect(parseFileChangeReport({ schema: 'xpert.file-change.v1', workspacePath: 'a', before: null, after: { sha256: hash('a'), size: 1, text: 'a' } })).not.toBeNull();
    expect(parseFileChangeReport({ schema: 'xpert.file-change.v1', workspacePath: 'a', before: null, after: { sha256: hash('a'), size: 1, text: 'a'.repeat(40000) } })).toBeNull();
  });
});
