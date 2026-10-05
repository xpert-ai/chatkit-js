import type { FileReviewEntry } from './file-change-review';

export type ReviewSettings = {
  layout: 'auto' | 'split' | 'unified';
  wrap: boolean;
  fullFile: boolean;
  wordDiff: boolean;
  hideWhitespace: boolean;
  hideImports: boolean;
  preview: boolean;
  metadata: boolean;
};
export const defaultReviewSettings: ReviewSettings = {
  layout: 'auto',
  wrap: false,
  fullFile: false,
  wordDiff: true,
  hideWhitespace: false,
  hideImports: false,
  preview: false,
  metadata: false,
};
/** Export exact saved bytes, including missing final newlines. No shell interpolation. */
export function reviewApplyCommand(entries: FileReviewEntry[]): string | null {
  if (!entries.length) return null;
  const patches: string[] = [];
  for (const { report, path } of entries) {
    if (
      !report ||
      !path ||
      path.startsWith('/') ||
      path.split('/').some((part) => part === '..') ||
      path.includes('\\') ||
      Array.from(path).some((char) => char.charCodeAt(0) < 32) ||
      (report.before && report.before.text === undefined) ||
      (report.after && report.after.text === undefined)
    )
      return null;
    if (report.before?.text === report.after?.text) continue;
    const oldText = report.before?.text ?? '',
      newText = report.after?.text ?? '';
    const split = (value: string) =>
      value ? value.replace(/\n$/, '').split('\n') : [];
    const before = split(oldText),
      after = split(newText);
    const quote = (value: string) => JSON.stringify(value);
    const content = (rows: string[], prefix: string, source: string) =>
      rows
        .map(
          (line, i) =>
            `${prefix}${line}\n${i === rows.length - 1 && !source.endsWith('\n') ? '\\ No newline at end of file\n' : ''}`,
        )
        .join('');
    patches.push(
      `diff --git ${quote('a/' + path)} ${quote('b/' + path)}\n${!report.before ? 'new file mode 100644\n' : !report.after ? 'deleted file mode 100644\n' : ''}--- ${report.before ? quote('a/' + path) : '/dev/null'}\n+++ ${report.after ? quote('b/' + path) : '/dev/null'}\n${before.length || after.length ? `@@ -${before.length ? 1 : 0},${before.length} +${after.length ? 1 : 0},${after.length} @@\n${content(before, '-', oldText)}${content(after, '+', newText)}` : ''}`,
    );
  }
  if (!patches.length) return null;
  const patch = patches.join('');
  let delimiter = 'CHATKIT_PATCH';
  while (patch.split('\n').includes(delimiter)) delimiter += '_';
  return `git apply <<'${delimiter}'\n${patch}${delimiter}`;
}
