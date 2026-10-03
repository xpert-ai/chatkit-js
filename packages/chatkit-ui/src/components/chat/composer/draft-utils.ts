export type ThreadMentionState = {
  start: number;
  end: number;
  query: string;
};

export function getThreadMention(
  text: string,
  caretOffset: number,
): ThreadMentionState | null {
  const beforeCaret = text.slice(0, caretOffset);
  const mentionStart = beforeCaret.lastIndexOf('@');
  if (mentionStart < 0) return null;

  const precedingCharacter = beforeCaret[mentionStart - 1];
  if (precedingCharacter && !/\s/.test(precedingCharacter)) return null;

  const query = beforeCaret.slice(mentionStart + 1);
  if (/[\n，,。！？!?]/.test(query)) return null;

  return { start: mentionStart, end: caretOffset, query };
}
