import { describe, expect, it } from 'vitest';
import {
  editMentions,
  insertMention,
  validMentions,
  hasUnboundMention,
} from './group-mentions';
const member = {
  id: 'b',
  name: 'Test User B',
  kind: 'user' as const,
  subjectId: 'user-b',
  active: true,
  role: 'member' as const,
};
describe('body-bound group mentions', () => {
  it('keeps names containing spaces bound to stable IDs', () => {
    const draft = insertMention('Hello @Test', [], member);
    expect(draft.text).toBe('Hello @Test User B ');
    expect(validMentions(draft.text, draft.mentions, [member])).toEqual(
      draft.mentions,
    );
    expect(hasUnboundMention(draft.text, draft.mentions)).toBe(false);
  });
  it('shifts a mention when text before it changes and drops it when the name is edited', () => {
    const draft = insertMention('', [], member);
    const shifted = editMentions(
      draft.text,
      'Hi ' + draft.text,
      draft.mentions,
    );
    expect(shifted[0].start).toBe(3);
    expect(editMentions(draft.text, '@Test User C ', draft.mentions)).toEqual(
      [],
    );
    expect(editMentions(draft.text, 'No mention', draft.mentions)).toEqual([]);
  });
  it('does not infer member IDs from pasted names or emails', () => {
    expect(hasUnboundMention('@Test User B help', [])).toBe(true);
    expect(hasUnboundMention('Send to b@example.com', [])).toBe(false);
    expect(hasUnboundMention('How does @ work?', [])).toBe(false);
    expect(
      validMentions(
        '@Test User B ',
        [{ participantId: 'other', start: 0, end: 12 }],
        [member],
      ),
    ).toEqual([]);
  });
});
