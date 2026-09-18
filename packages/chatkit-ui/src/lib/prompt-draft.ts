export type PromptDraft = {
  text: string;
  ranges: Array<{ start: number; end: number }>;
};

export function createPromptDraft(template: string, args = ''): PromptDraft {
  const ranges: PromptDraft['ranges'] = [];
  let text = '';
  let from = 0;
  for (const match of template.matchAll(/\{\{\s*args\s*\}\}/g)) {
    text += template.slice(from, match.index);
    const start = text.length;
    text += args;
    ranges.push({ start, end: text.length });
    from = match.index + match[0].length;
  }
  text += template.slice(from);
  if (!ranges.length) {
    text += '\n\n';
    ranges.push({ start: text.length, end: text.length + args.length });
    text += args;
  }
  return { text, ranges };
}

/** Move argument ranges through a user's edit without rewriting the prompt body. */
export function updatePromptDraft(
  draft: PromptDraft,
  text: string,
): PromptDraft {
  if (text === draft.text) return draft;
  let start = 0;
  while (
    start < text.length &&
    start < draft.text.length &&
    text[start] === draft.text[start]
  )
    start++;
  let oldEnd = draft.text.length;
  let newEnd = text.length;
  while (
    oldEnd > start &&
    newEnd > start &&
    draft.text[oldEnd - 1] === text[newEnd - 1]
  ) {
    oldEnd--;
    newEnd--;
  }
  const delta = newEnd - oldEnd;
  const ranges = draft.ranges.flatMap((range) => {
    if (oldEnd < range.start || (oldEnd === range.start && start !== oldEnd)) {
      return [{ start: range.start + delta, end: range.end + delta }];
    }
    if (start > range.end) return [range];
    if (start >= range.start && oldEnd <= range.end) {
      return [{ start: range.start, end: range.end + delta }];
    }
    // A replacement crossing prompt/argument boundaries no longer has a safe insertion range.
    return [];
  });
  return { text, ranges };
}

export function fillPromptDraft(draft: PromptDraft, args: string): PromptDraft {
  if (!draft.ranges.length) return createPromptDraft(draft.text, args);
  let text = '';
  let from = 0;
  const ranges = draft.ranges.map((range) => {
    text += draft.text.slice(from, range.start);
    const start = text.length;
    text += args;
    from = range.end;
    return { start, end: text.length };
  });
  text += draft.text.slice(from);
  return { text, ranges };
}
