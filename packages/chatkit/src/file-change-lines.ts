import type { FileChangeLineStats, FileChangeReport } from './file-activity.js';

const MAX_DIFF_CELLS = 4_000_000;

/** Exact line LCS with bounded CPU/memory. Unknown text never becomes zero changes. */
export function countFileChangeLines(report: FileChangeReport): FileChangeLineStats {
    if ((report.before && report.before.text === undefined) || (report.after && report.after.text === undefined)) return { status: 'unavailable' }
    const lines = (text: string) => text ? text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n') : []
    const before = lines(report.before?.text ?? ''), after = lines(report.after?.text ?? '')
    let start = 0, endBefore = before.length, endAfter = after.length
    while (start < endBefore && start < endAfter && before[start] === after[start]) start++
    while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) { endBefore--; endAfter-- }
    const n = endBefore - start, m = endAfter - start
    if (n * m > MAX_DIFF_CELLS) return { status: 'unavailable' }
    let previous = new Uint32Array(m + 1), current = new Uint32Array(m + 1)
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < m; j++) current[j + 1] = before[start + i] === after[start + j] ? previous[j] + 1 : Math.max(previous[j + 1], current[j])
        ;[previous, current] = [current, previous]
    }
    return { status: 'ready', added: m - previous[m], removed: n - previous[m] }
}
