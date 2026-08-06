import { describe, expect, it } from 'vitest';

import { addBrowserActionEvidence } from './action-trace';

describe('addBrowserActionEvidence', () => {
  it('adds factual action evidence without preserving sensitive URL values', () => {
    const result = addBrowserActionEvidence(
      'host_page_click',
      'https://example.com/checkout?token=secret&view=summary#credential=hidden',
      {
        dispatched: true,
        outcome: 'executed_unverified',
        requiresFreshSnapshot: true,
        invalidatedPageStateId: 'page-1',
        resolution: {
          requested: {
            kind: 'ref',
            pageStateId: 'page-1',
            documentRef: 'd1',
            ref: 'e1',
          },
          strategy: 'ref',
          pageStateId: 'page-1',
        },
      },
    );

    expect(result).toMatchObject({
      evidence: {
        timestamp: expect.any(String),
        pageStateId: 'page-1',
        url: 'https://example.com/checkout?token=%5BREDACTED%5D&view=summary',
        action: 'host_page_click',
        outcome: 'executed_unverified',
        requested: {
          kind: 'ref',
          pageStateId: 'page-1',
          documentRef: 'd1',
          ref: 'e1',
        },
        resolution: {
          strategy: 'ref',
          pageStateId: 'page-1',
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('credential=hidden');
  });

  it('leaves non-action results unchanged', () => {
    const snapshot = { pageStateId: 'page-1', title: 'Example' };

    expect(
      addBrowserActionEvidence(
        'host_page_snapshot',
        'https://example.com',
        snapshot,
      ),
    ).toBe(snapshot);
  });
});
