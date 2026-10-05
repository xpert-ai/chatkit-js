import { parseDiffFromFile } from '@pierre/diffs';
import type { FileChangeReport } from '@xpert-ai/chatkit-types';

/** Saved reports are bounded upstream; keep direct/custom loaders bounded as well. */
export function createReviewDiff(
  report: FileChangeReport,
  hideWhitespace = false,
) {
  const before = report.before?.text ?? '';
  const after = report.after?.text ?? '';
  if (
    before.length + after.length > 300_000 ||
    before.split('\n').length + after.split('\n').length > 12_000
  )
    return null;
  try {
    return parseDiffFromFile(
      report.before
        ? {
            name: report.workspacePath,
            contents: before.replace(/\r\n/g, '\n'),
          }
        : null,
      report.after
        ? { name: report.workspacePath, contents: after.replace(/\r\n/g, '\n') }
        : null,
      { context: 3, ignoreWhitespace: hideWhitespace },
    );
  } catch {
    return null;
  }
}
