import { describe, expect, it } from 'vitest';
import { previewToolValue, isToolActivity } from '@xpert-ai/chatkit-types';
import { parseToolCallPresentation } from './tool-call-presentation';

describe('tool timeline presentation boundaries', () => {
  it('bounds UTF-8 text without splitting Unicode and retains full local content', () => {
    const text = '🙂'.repeat(1000);
    const result = previewToolValue(text);
    expect(result.preview).toBe('🙂'.repeat(512));
    expect(result.text).toBe(text);
    expect(result.presentation).toMatchObject({
      byteLength: 4000,
      truncated: true,
    });
  });

  it('limits text lines and does not count a trailing newline as an extra line', () => {
    const result = previewToolValue('line\n'.repeat(20));
    expect(String(result.preview).split('\n')).toHaveLength(6);
    expect(result.presentation).toMatchObject({
      lineCount: 20,
      truncated: true,
    });
    expect(previewToolValue('').presentation.lineCount).toBe(0);
  });

  it('limits collections and nested values while keeping valid JSON', () => {
    const result = previewToolValue({
      rows: Array.from({ length: 20 }, (_, id) => ({ id })),
    });
    expect(result.preview).toEqual({ rows: [{}, {}, {}, {}, {}] });
    expect(result.presentation.truncated).toBe(true);
    expect(JSON.parse(JSON.stringify(result.preview))).toEqual(result.preview);
  });

  it('enforces the byte budget on aggregate JSON keys as well as values', () => {
    const result = previewToolValue({ ['long'.repeat(600)]: 'value' });
    expect(result.preview).toEqual({});
    expect(result.presentation.truncated).toBe(true);
    expect(result.text).toContain('value');
  });

  it('recognizes complete JSON containers while leaving partial and scalar text intact', () => {
    expect(previewToolValue('{"ok":true}').preview).toEqual({ ok: true });
    for (const text of ['{"ok":', 'null', '0', 'false']) {
      expect(previewToolValue(text).presentation.format).toBe('text');
      expect(previewToolValue(text).preview).toBe(text);
    }
    for (const value of [null, false, 0, [], {}]) {
      expect(previewToolValue(value).preview).toEqual(value);
      expect(previewToolValue(value).presentation.truncated).toBe(false);
    }
  });

  it('keeps summary mode free of body content', () => {
    const result = previewToolValue('Skill body', 'summary');
    expect(result.preview).toBeUndefined();
    expect(result.presentation).toMatchObject({
      mode: 'summary',
      byteLength: 10,
      truncated: true,
    });
  });

  it('rejects invalid activity pairs without inferring semantics from names', () => {
    for (const value of [
      { kind: 'file', action: 'execute' },
      { kind: '__proto__', action: 'read' },
      { kind: 'skill', action: 'read', tool: 'read_skill_file' },
    ]) {
      expect(isToolActivity(value)).toBe(false);
      expect(
        parseToolCallPresentation({
          version: 1,
          activity: value,
          target: 'file.md',
        }),
      ).toEqual({ version: 1, target: 'file.md' });
    }
  });
});
