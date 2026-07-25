import { describe, expect, it } from 'vitest';
import { mergeStreamRequestContext } from './Stream';

describe('mergeStreamRequestContext', () => {
  it('preserves base context and merges workbench named contexts and env', () => {
    expect(
      mergeStreamRequestContext(
        {
          existing: { value: true },
          env: { BASE_URL: 'base', SHARED: 'base' },
        },
        {
          knowledgebase_workbench: {
            knowledgebaseId: 'kb-1',
            documentIds: ['doc-1'],
          },
          env: { SHARED: 'workbench', DOCUMENT_ID: 'doc-1' },
        },
      ),
    ).toEqual({
      existing: { value: true },
      knowledgebase_workbench: {
        knowledgebaseId: 'kb-1',
        documentIds: ['doc-1'],
      },
      env: {
        BASE_URL: 'base',
        SHARED: 'workbench',
        DOCUMENT_ID: 'doc-1',
      },
    });
  });
});
