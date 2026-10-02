import { describe, expect, it } from 'vitest';
import { prepareToolOutputDisplay } from './tool-output-display';

const pixels = `data:image/png;base64,${'secret-pixels'.repeat(1000)}`;
const placeholder = (mime: string) => `[${mime} omitted]`;

describe('legacy tool image display', () => {
  it.each([false, true])(
    'redacts structured image URLs without changing history (serialized: %s)',
    (serialized) => {
      const blocks = [
        { type: 'text', text: 'Prepared the construction image.' },
        { type: 'image_url', image_url: { url: pixels, detail: 'high' } },
        { type: 'image_url', image_url: 'data:image/jpeg;base64,other-pixels' },
      ];
      const original = JSON.stringify(blocks);
      const result = prepareToolOutputDisplay(
        serialized ? original : blocks,
        placeholder,
      );
      expect(result.omittedImageCount).toBe(2);
      expect(result.display).toMatchObject({
        kind: 'json',
        value: [
          blocks[0],
          {
            type: 'image_url',
            image_url: { url: '[image/png omitted]', detail: 'high' },
          },
          { type: 'image_url', image_url: '[image/jpeg omitted]' },
        ],
      });
      expect(JSON.stringify(result)).not.toContain('secret-pixels');
      expect(JSON.stringify(result)).not.toContain('data:image/');
      expect(JSON.stringify(blocks)).toBe(original);
    },
  );

  it('handles nested results and unsupported embedded image types without rendering them', () => {
    const result = prepareToolOutputDisplay(
      {
        output: {
          content: [
            {
              type: 'image_url',
              image_url: { url: 'DATA:IMAGE/SVG+XML,%3Csvg%3E', detail: 'low' },
            },
          ],
        },
      },
      placeholder,
    );
    expect(result.omittedImageCount).toBe(1);
    expect(JSON.stringify(result)).toContain('[image/svg+xml omitted]');
    expect(JSON.stringify(result)).not.toContain('%3Csvg');
  });

  it('summarizes a standalone image data URL', () => {
    expect(prepareToolOutputDisplay(pixels, placeholder)).toEqual({
      display: { kind: 'text', text: '[image/png omitted]' },
      omittedImageCount: 1,
    });
  });

  it('leaves ordinary tool text, structured results, and remote references unchanged', () => {
    expect(prepareToolOutputDisplay('Task finished.', placeholder)).toEqual({
      display: { kind: 'text', text: 'Task finished.' },
      omittedImageCount: 0,
    });
    const value = {
      ok: true,
      image_url: { url: 'https://example.com/reference.png' },
      count: 3,
    };
    expect(prepareToolOutputDisplay(value, placeholder)).toEqual({
      display: { kind: 'json', value, raw: JSON.stringify(value, null, 2) },
      omittedImageCount: 0,
    });
  });

  it('preserves ordinary Base64 text, non-image data URLs, and explanatory source code', () => {
    const value = {
      encodedText: 'SGVsbG8sIHdvcmxkIQ==',
      document: 'data:application/pdf;base64,JVBERi0xLjQ=',
      plainText: 'data:text/plain;base64,SGVsbG8=',
      example:
        'Use an image_url block with data:image/png;base64,... for images.',
      code: 'const image = "data:image/png;base64,iVBORw0KGgo=";',
    };
    const result = prepareToolOutputDisplay(value, placeholder);
    expect(result.omittedImageCount).toBe(0);
    expect(result.display).toEqual({
      kind: 'json',
      value,
      raw: JSON.stringify(value, null, 2),
    });
  });

  it('keeps summaries bounded even for a maliciously oversized MIME header', () => {
    const value = {
      image_url: `data:image/${'a'.repeat(1_000_000)};base64,PRIVATE_PIXELS`,
    };
    const result = prepareToolOutputDisplay(value, placeholder);
    expect(result.omittedImageCount).toBe(1);
    expect(JSON.stringify(result).length).toBeLessThan(250);
    expect(JSON.stringify(result)).toContain('[image/* omitted]');
    expect(JSON.stringify(result)).not.toContain('PRIVATE_PIXELS');
  });

  it('handles long parameter headers and non-matching headers without decoding the body', () => {
    const parameters = `data:image/png;${'x'.repeat(1_000_000)}`;
    const result = prepareToolOutputDisplay(
      `${parameters},${'A'.repeat(2_000_000)}`,
      placeholder,
    );
    expect(result).toEqual({
      display: { kind: 'text', text: '[image/png omitted]' },
      omittedImageCount: 1,
    });
    expect(prepareToolOutputDisplay(parameters, placeholder)).toEqual({
      display: { kind: 'text', text: parameters },
      omittedImageCount: 0,
    });
  });
});
