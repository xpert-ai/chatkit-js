import { describe, it, expect } from 'vitest';
import { parseFileActivityContent, isFileActivityContent, projectMessageFileActivity } from '@xpert-ai/chatkit-types';
import { applyFileActivityReceipt } from './stream-file-activity';
import { buildAssistantRenderTree, getAgentRunCounts } from './agent-run-render-tree';
import { filterInternalMessageContentArtifacts, hasRenderableMessageContent } from './message';
import { actualTool, changesReceipt, deliveryReceipt, legacyReceipt } from '../test/file-activity-fixtures';

 describe('file activity protocol', () => {
  it('validates facts without treating tool titles or attached summaries as receipts', () => {
    expect(parseFileActivityContent(changesReceipt)).toEqual(changesReceipt);
    expect(parseFileActivityContent({ ...changesReceipt, data: { ...changesReceipt.data, version: 2 } })).toBeNull();
    expect(parseFileActivityContent({ ...changesReceipt, data: { ...changesReceipt.data, fileChanges: [null] } })).toBeNull();
    expect(isFileActivityContent(legacyReceipt)).toBe(true);
    expect(isFileActivityContent({ ...actualTool, data: { ...actualTool.data, title: 'File changes' } })).toBe(false);
    expect(isFileActivityContent({ ...legacyReceipt, id: 'call' })).toBe(false);
    expect(isFileActivityContent({ ...actualTool, id: 'call:file-delivery', data: { ...actualTool.data, title: 'File delivery', status: 'error' } })).toBe(false);
  });
  it('keeps facts on hydration while excluding them from visible content and agent counts', () => {
    const content = [actualTool, changesReceipt, legacyReceipt];
    expect(filterInternalMessageContentArtifacts(content)).toEqual(content);
    expect(hasRenderableMessageContent([changesReceipt, legacyReceipt])).toBe(false);
    const tree = buildAssistantRenderTree({ id: 'reply', type: 'assistant', executionId: 'root', content,
      agentRuns: [{ id: 'run', parentId: 'root', status: 'success' }, { id: 'root', isRoot: true, status: 'success' }] });
    const node = tree.units.find(unit => unit.type === 'agent');
    expect(node?.type === 'agent' && getAgentRunCounts(node.node).tools).toBe(1);
  });
  it('routes delayed and replayed receipts to the owning message without changing its completion status', () => {
    const messages = [{ id: 'reply', type: 'ai', executionId: 'run', status: 'success', content: 'Answer' }, { id: 'later', type: 'ai', executionId: 'run2', status: 'thinking', content: '' }];
    const once = applyFileActivityReceipt(messages, changesReceipt);
    const twice = applyFileActivityReceipt(once, changesReceipt);
    expect(twice).toEqual(once);
    expect(twice[0].status).toBe('success');
    expect(twice[1]).toEqual(messages[1]);
    expect(applyFileActivityReceipt(messages, { ...changesReceipt, messageId: 'absent' })).toEqual(messages);
    expect(applyFileActivityReceipt(messages, { ...changesReceipt, messageId: undefined, executionId: undefined })).toEqual(messages);
  });
  it('produces identical file summaries from new receipts and persisted legacy receipts', () => {
    const fresh = projectMessageFileActivity({ id: 'reply', content: [actualTool, changesReceipt, deliveryReceipt] }, { version: 1 });
    const restored = projectMessageFileActivity({ id: 'reply', content: JSON.parse(JSON.stringify([actualTool, legacyReceipt, deliveryReceipt])) }, { version: 1 });
    expect(restored.fileChanges).toEqual(fresh.fileChanges);
    expect(restored.outputs).toEqual(fresh.outputs);
    expect(fresh.outputs?.[0].resource).toMatchObject({ artifactVersionId: 'v1' });
  });
  it('retains no-op observation without inventing a legacy write', () => {
    const receipt = { ...changesReceipt, data: { ...changesReceipt.data, kind: 'changes' as const, coverage: 'bounded' as const, fileChanges: [] } };
    expect(projectMessageFileActivity({ content: [actualTool, receipt] }, { version: 1 }).fileChanges).toEqual([]);
  });
});
