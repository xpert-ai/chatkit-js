import { describe, expect, it } from 'vitest';

import {
  buildHumanMessageInputPayload,
  getReferenceKey,
  getReferenceLabel,
  getReferenceMetaLine,
  getReferenceTitle,
  normalizeReferences,
} from './references';

describe('normalizeReferences', () => {
  it('normalizes explicit quote references', () => {
    expect(
      normalizeReferences([
        {
          type: 'quote',
          source: 'Assistant response',
          text: 'Look at the prior answer.',
        },
      ]),
    ).toEqual([
      {
        type: 'quote',
        source: 'Assistant response',
        text: 'Look at the prior answer.',
      },
    ]);
  });

  it('accepts legacy code-shaped references without an explicit type', () => {
    expect(
      normalizeReferences([
        {
          path: 'src/app.ts',
          startLine: 10,
          endLine: 14,
          text: 'console.log("hello");',
          language: 'ts',
        },
      ]),
    ).toEqual([
      {
        type: 'code',
        path: 'src/app.ts',
        startLine: 10,
        endLine: 14,
        text: 'console.log("hello");',
        language: 'ts',
      },
    ]);
  });

  it('normalizes image references with metadata', () => {
    expect(
      normalizeReferences([
        {
          type: 'image',
          fileId: 'file-1',
          url: 'https://example.com/image.png',
          mimeType: 'image/png',
          name: 'diagram.png',
          size: 2048,
          width: 640,
          height: 480,
          text: 'Pasted image: diagram.png',
        },
      ]),
    ).toEqual([
      {
        type: 'image',
        fileId: 'file-1',
        url: 'https://example.com/image.png',
        mimeType: 'image/png',
        name: 'diagram.png',
        size: 2048,
        width: 640,
        height: 480,
        text: 'Pasted image: diagram.png',
      },
    ]);
  });
});

describe('buildHumanMessageInputPayload', () => {
  const references = [
    {
      type: 'code' as const,
      path: 'src/app.ts',
      startLine: 10,
      endLine: 14,
      text: 'console.log("hello");',
      language: 'ts',
    },
  ];

  it('preserves the submitted input when provided', () => {
    expect(
      buildHumanMessageInputPayload({
        content: 'display-only content',
        submittedInput: 'Already synthesized input',
        references,
      }),
    ).toEqual({
      input: 'Already synthesized input',
      references,
    });
  });

  it('marks fresh text plus references for server-side composition', () => {
    expect(
      buildHumanMessageInputPayload({
        content: 'Please review this function',
        references,
      }),
    ).toEqual({
      input: 'Please review this function',
      references,
      referenceComposition: 'compose',
    });
  });

  it('keeps reference-only payloads structured without composing prompt text', () => {
    expect(
      buildHumanMessageInputPayload({
        content: '   ',
        references,
      }),
    ).toEqual({
      input: '',
      references,
      referenceComposition: 'compose',
    });
  });

  it('preserves an explicit composition mode with submitted input', () => {
    expect(
      buildHumanMessageInputPayload({
        content: 'display-only content',
        submittedInput: 'Already synthesized input',
        references,
        referenceComposition: 'compose',
      }),
    ).toEqual({
      input: 'Already synthesized input',
      references,
      referenceComposition: 'compose',
    });
  });

  it('returns null when there is no text or reference context', () => {
    expect(
      buildHumanMessageInputPayload({
        content: '   ',
        references: [],
      }),
    ).toBeNull();
  });
});

describe('getReferenceMetaLine', () => {
  it('shows the full code location for code references', () => {
    expect(
      getReferenceMetaLine({
        type: 'code',
        path: 'src/app.ts',
        startLine: 10,
        endLine: 14,
        text: 'console.log("hello");',
      }),
    ).toBe('src/app.ts:10-14');
  });

  it('shows a quote excerpt when the quote has a source label', () => {
    expect(
      getReferenceMetaLine({
        type: 'quote',
        source: 'Assistant response',
        text: 'This is the earlier answer that we want to cite back.',
      }),
    ).toBe('This is the earlier answer th...');
  });

  it('shows concise image metadata for image references', () => {
    expect(
      getReferenceMetaLine({
        type: 'image',
        fileId: 'file-1',
        mimeType: 'image/png',
        name: 'diagram.png',
        width: 640,
        height: 480,
        size: 2048,
        text: 'Pasted image: diagram.png',
      }),
    ).toBe('image/png • 640x480 • 2.0 KB');
  });
});

describe('image reference display helpers', () => {
  const imageReference = {
    type: 'image' as const,
    fileId: 'file-1',
    url: 'https://example.com/image.png',
    mimeType: 'image/png',
    name: 'diagram.png',
    width: 640,
    height: 480,
    size: 2048,
    text: 'Pasted image: diagram.png',
  };

  it('prefers the file id when building image reference keys', () => {
    expect(getReferenceKey(imageReference)).toBe('image:file-1');
  });

  it('uses the original file name as the image label', () => {
    expect(getReferenceLabel(imageReference)).toBe('diagram.png');
  });

  it('builds a readable image tooltip without dumping binary content', () => {
    expect(getReferenceTitle(imageReference)).toBe(
      [
        'diagram.png',
        'image/png • 640x480 • 2.0 KB',
        'https://example.com/image.png',
        '',
        'Pasted image: diagram.png',
      ].join('\n'),
    );
  });
});
