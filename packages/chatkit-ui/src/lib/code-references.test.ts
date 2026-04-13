import { describe, expect, it } from 'vitest';

import {
  buildCodeReferencePrompt,
  buildHumanMessageInputPayload,
} from './code-references';

const references = [
  {
    path: 'src/app.ts',
    startLine: 10,
    endLine: 14,
    text: 'console.log("hello");',
    language: 'ts',
  },
];

describe('buildHumanMessageInputPayload', () => {
  it('prefers the submitted input when a human message stores display-only content', () => {
    const submittedInput = buildCodeReferencePrompt('', references);

    expect(
      buildHumanMessageInputPayload({
        content: 'Referenced code',
        submittedInput,
        references,
      }),
    ).toEqual({
      input: submittedInput,
      references,
    });
  });

  it('rebuilds the reference prompt when submitted input is not stored yet', () => {
    expect(
      buildHumanMessageInputPayload({
        content: 'Please review this change',
        references,
      }),
    ).toEqual({
      input: buildCodeReferencePrompt('Please review this change', references),
      references,
    });
  });

  it('returns null when there is no text or code reference context to send', () => {
    expect(
      buildHumanMessageInputPayload({
        content: '   ',
        references: [],
      }),
    ).toBeNull();
  });
});
