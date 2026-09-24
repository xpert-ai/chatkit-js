import { describe, it, expect } from 'vitest';
import { countFileChangeLines, type FileChangeReport } from '@xpert-ai/chatkit-types';
const revision = (text: string) => ({ text, size: text.length, sha256: 'a'.repeat(64) });
const report = (before: string | null, after: string | null): FileChangeReport => ({ schema: 'xpert.file-change.v1', workspacePath: 'file.txt', before: before === null ? null : revision(before), after: after === null ? null : revision(after) });
describe('bounded net line counts', () => {
  it.each([
    [null, 'one\ntwo\n', 2, 0], ['one\ntwo', null, 0, 2], ['', '', 0, 0], ['same\r\n', 'same\n', 0, 0],
    ['a\nold\nc\n', 'a\nnew\nc\n', 1, 1], ['repeat\nx\nrepeat', 'repeat\nrepeat\ny', 1, 1], ['\n', '', 0, 1],
  ])('counts %s → %s', (before, after, added, removed) => {
    expect(countFileChangeLines(report(before, after))).toEqual({ status: 'ready', added, removed });
  });
  it('omits unknown binary/truncated history and bounds expensive diffs', () => {
    expect(countFileChangeLines({ ...report(null, ''), after: { size: 4, sha256: 'a'.repeat(64) } })).toEqual({ status: 'unavailable' });
    expect(countFileChangeLines(report('a\n'.repeat(2001), 'b\n'.repeat(2001)))).toEqual({ status: 'unavailable' });
  });
});
