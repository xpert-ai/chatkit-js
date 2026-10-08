import { describe, expect, it } from 'vitest';
import {
  createResourceCardContent,
  parseResourceCard,
  parseResourceCardContent,
} from '@xpert-ai/chatkit-types';

const card = {
  resource: { namespace: 'bid', type: 'export', id: 'version' },
  title: '标书.docx',
  open: {
    target: 'workbench.file' as const,
    viewKey: 'bid',
    fileKey: 'export',
    targetId: 'version',
    previewFile: { viewKey: 'bid', fileKey: 'export-pdf', targetId: 'version' },
  },
};
describe('resource card file targets', () => {
  it('round trips stable preview and download references through saved messages', () => {
    const saved = createResourceCardContent(card);
    expect(
      parseResourceCardContent(JSON.parse(JSON.stringify(saved)))?.data,
    ).toEqual(card);
  });
  it.each([
    { fileKey: '' },
    { targetId: '' },
    { url: 'https://example.org/file' },
    { parameters: {} },
    { projectId: 'other' },
    { selectionId: 'other' },
    { previewFile: { ...card.open.previewFile, url: 'https://example.org' } },
    { target: 'workbench.view' },
  ])('rejects malformed or mixed file navigation %j', (patch) => {
    expect(
      parseResourceCard({ ...card, open: { ...card.open, ...patch } }),
    ).toBeNull();
  });
});
