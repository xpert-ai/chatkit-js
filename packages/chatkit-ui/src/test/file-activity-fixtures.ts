import { ChatMessageStepCategory } from '@xpert-ai/chatkit-types';
import type { TMessageContentFileActivity, TMessageContentComponent, TMessageComponentStep, TChatTaskSummaryContribution } from '@xpert-ai/chatkit-types';

export const changesReceipt: TMessageContentFileActivity = {
  id: 'receipt-changes', type: 'file_activity', messageId: 'reply', executionId: 'run',
  data: { version: 1, receiptId: 'receipt-changes', toolCallId: 'call', kind: 'changes', updatedAt: '2026-09-24T00:00:00Z', coverage: 'bounded',
    fileChanges: [{ id: 'change', workspacePath: 'final.json', title: 'final.json', operation: 'added', coverage: 'observed', before: null,
      after: { sha256: 'a'.repeat(64), size: 2 }, resource: { type: 'file_change', first: { artifactId: 'review', artifactVersionId: 'v1' }, last: { artifactId: 'review', artifactVersionId: 'v1' } } }] }
};
export const deliveryReceipt: TMessageContentFileActivity = {
  ...changesReceipt, id: 'receipt-delivery', data: { version: 1, receiptId: 'receipt-delivery', toolCallId: 'call', kind: 'delivery', status: 'success', updatedAt: '2026-09-24T00:00:00Z',
    outputs: [{ id: 'deliverable', title: 'Final report', kind: 'file', status: 'success', origin: 'tool', workspacePath: 'final.json', resource: { type: 'artifact', artifactId: 'report', artifactVersionId: 'v1' } }] }
};
export const actualTool: TMessageContentComponent<Partial<TMessageComponentStep>> = { id: 'call', type: 'component', executionId: 'run', data: { category: 'Tool', type: ChatMessageStepCategory.Program, tool: 'sandbox_write_file', title: 'Write final.json', status: 'success', input: { file_path: 'final.json' } } };
export const legacyReceipt: TMessageContentComponent<Partial<TMessageComponentStep> & { _meta: { 'xpertai/taskSummary': TChatTaskSummaryContribution } }> = { id: 'legacy-receipt', type: 'component', executionId: 'run', data: { category: 'Tool', type: ChatMessageStepCategory.Program, tool: 'sandbox_write_file', title: 'File changes', status: 'success',
  _meta: { 'xpertai/taskSummary': { version: 1, fileActivityVersion: 1, fileActivityToolCallId: 'call', fileChanges: changesReceipt.data.kind === 'changes' ? changesReceipt.data.fileChanges : [] } satisfies TChatTaskSummaryContribution } } };
