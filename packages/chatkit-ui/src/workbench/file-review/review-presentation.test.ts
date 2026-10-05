// @vitest-environment node
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { reviewApplyCommand } from './review-presentation';
import type { FileReviewEntry } from './file-change-review';

const revision = (text: string) => ({
  text,
  size: text.length,
  sha256: 'a'.repeat(64),
});
function entry(
  path: string,
  before: string | null,
  after: string | null,
): FileReviewEntry {
  return {
    key: path,
    path,
    report: {
      schema: 'xpert.file-change.v1',
      workspacePath: path,
      before: before === null ? null : revision(before),
      after: after === null ? null : revision(after),
    },
  };
}
describe('review patch export', () => {
  it('applies saved additions, modifications, deletions, CRLF, missing EOF newline, and quoted paths exactly', () => {
    const entries = [
      entry('src/changed.ts', 'old\nline\n', 'new\nline\n'),
      entry('src/added.ts', null, 'new without newline'),
      entry('src/deleted.ts', 'gone\n', null),
      entry('src/crlf.ts', 'old\r\n', 'new\r\n'),
      entry('src/空 格"file.ts', 'a', 'b'),
      entry('src/empty.ts', null, ''),
      entry('src/empty-deleted.ts', '', null),
      entry('src/literal.ts', 'old', '$(echo must-not-run)\nCHATKIT_PATCH\n'),
    ];
    const directory = mkdtempSync(join(tmpdir(), 'chatkit-review-'));
    try {
      for (const item of entries)
        if (item.report?.before) {
          const path = join(directory, item.path);
          mkdirSync(dirname(path), { recursive: true });
          writeFileSync(path, item.report.before.text ?? '');
        }
      const command = reviewApplyCommand(entries);
      if (!command) throw new Error('Expected a complete patch');
      const patch = command.slice(
        command.indexOf('\n') + 1,
        command.lastIndexOf('\n') + 1,
      );
      execFileSync('git', ['apply', '--check', '-'], {
        cwd: directory,
        input: patch,
      });
      execFileSync('git', ['apply', '-'], { cwd: directory, input: patch });
      for (const item of entries) {
        if (!item.report?.after)
          expect(existsSync(join(directory, item.path))).toBe(false);
        else
          expect(readFileSync(join(directory, item.path), 'utf8')).toBe(
            item.report.after.text,
          );
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it('does not export incomplete sets, binary files, or out-of-workspace paths', () => {
    expect(reviewApplyCommand([])).toBeNull();
    expect(
      reviewApplyCommand([{ key: 'missing', path: 'missing' }]),
    ).toBeNull();
    expect(
      reviewApplyCommand([
        {
          ...entry('binary', '', ''),
          report: {
            schema: 'xpert.file-change.v1',
            workspacePath: 'binary',
            before: revision(''),
            after: { size: 3, sha256: 'a'.repeat(64) },
          },
        },
      ]),
    ).toBeNull();
    for (const path of [
      '/etc/file',
      '../outside',
      'src/../../file',
      'file\nname',
      'src\\file',
    ])
      expect(reviewApplyCommand([entry(path, 'a', 'b')])).toBeNull();
    expect(reviewApplyCommand([entry('same', 'a', 'a')])).toBeNull();
  });
});
