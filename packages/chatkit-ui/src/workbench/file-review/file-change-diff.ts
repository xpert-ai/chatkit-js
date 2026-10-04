export type DiffLine = { number: number; text: string };
export type DiffRow = { equal: boolean; before?: DiffLine; after?: DiffLine };
const lines = (text: string) =>
  text ? text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n') : [];

/** Bounded exact line diff. Large rewrites use the virtualized text viewers instead. */
export function diffRows(
  beforeText: string,
  afterText: string,
): DiffRow[] | null {
  const before = lines(beforeText),
    after = lines(afterText);
  if (before.length + after.length > 5000) return null;
  let start = 0,
    endBefore = before.length,
    endAfter = after.length;
  while (
    start < endBefore &&
    start < endAfter &&
    before[start] === after[start]
  )
    start++;
  while (
    endBefore > start &&
    endAfter > start &&
    before[endBefore - 1] === after[endAfter - 1]
  ) {
    endBefore--;
    endAfter--;
  }
  const n = endBefore - start,
    m = endAfter - start;
  if (n * m > 4_000_000) return null;
  const width = m + 1,
    matrix = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      matrix[i * width + j] =
        before[start + i] === after[start + j]
          ? matrix[(i + 1) * width + j + 1] + 1
          : Math.max(matrix[(i + 1) * width + j], matrix[i * width + j + 1]);
  const result: DiffRow[] = [];
  const left = (i: number) => ({ number: i + 1, text: before[i] });
  const right = (j: number) => ({ number: j + 1, text: after[j] });
  for (let i = 0; i < start; i++)
    result.push({ equal: true, before: left(i), after: right(i) });
  let i = 0,
    j = 0;
  let removed: DiffLine[] = [],
    added: DiffLine[] = [];
  const flush = () => {
    for (let k = 0; k < Math.max(removed.length, added.length); k++)
      result.push({ equal: false, before: removed[k], after: added[k] });
    removed = [];
    added = [];
  };
  while (i < n || j < m) {
    if (i < n && j < m && before[start + i] === after[start + j]) {
      flush();
      result.push({
        equal: true,
        before: left(start + i++),
        after: right(start + j++),
      });
    } else if (
      i < n &&
      (j === m || matrix[(i + 1) * width + j] >= matrix[i * width + j + 1])
    )
      removed.push(left(start + i++));
    else added.push(right(start + j++));
  }
  flush();
  while (endBefore < before.length)
    result.push({
      equal: true,
      before: left(endBefore++),
      after: right(endAfter++),
    });
  return result;
}
