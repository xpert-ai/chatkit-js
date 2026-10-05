import { tsxLanguage } from '@codemirror/lang-javascript';

/** Parse declarations so comments, string literals and dynamic imports stay visible. */
export function importLineNumbers(text: string): number[] {
  const lines: number[] = [];
  const starts = [0];
  for (let i = 0; i < text.length; i++)
    if (text[i] === '\n') starts.push(i + 1);
  let line = 0;
  tsxLanguage.parser.parse(text).iterate({
    enter(node) {
      if (node.name !== 'ImportDeclaration') return;
      while (line + 1 < starts.length && starts[line + 1] <= node.from) line++;
      for (
        let current = line;
        current < starts.length && starts[current] < node.to;
        current++
      )
        lines.push(current + 1);
      return false;
    },
  });
  return lines;
}
export function importSelectors(
  text: string,
  side: 'additions' | 'deletions',
  split: boolean,
) {
  return importLineNumbers(text).map((line) =>
    split
      ? `[data-code][data-${side}] [data-line="${line}"]`
      : `[data-code] [data-line="${line}"]${side === 'deletions' ? '[data-line-type="deletion"]' : ':not([data-line-type="deletion"])'}`,
  );
}
