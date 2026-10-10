import type {
  ChatGroupMention,
  ChatGroupParticipant,
} from '@xpert-ai/xpert-sdk';

/** Preserve member bindings only while the exact text span survives the edit. */
export function editMentions(
  before: string,
  after: string,
  mentions: ChatGroupMention[],
) {
  let prefix = 0;
  while (
    prefix < before.length &&
    prefix < after.length &&
    before[prefix] === after[prefix]
  )
    prefix++;
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - suffix - 1] === after[after.length - suffix - 1]
  )
    suffix++;
  const oldEnd = before.length - suffix;
  const delta = after.length - before.length;
  return mentions.flatMap((mention) => {
    if (mention.end <= prefix) return [mention];
    if (mention.start >= oldEnd)
      return [
        { ...mention, start: mention.start + delta, end: mention.end + delta },
      ];
    return [];
  });
}
export function validMentions(
  text: string,
  mentions: ChatGroupMention[],
  members: ChatGroupParticipant[],
) {
  return mentions.filter((mention) => {
    const member = members.find(
      (member) => member.active && member.id === mention.participantId,
    );
    return (
      member &&
      mention.start >= 0 &&
      mention.end <= text.length &&
      text.slice(mention.start, mention.end) === `@${member.name}` &&
      (!mention.start || /\s/.test(text[mention.start - 1])) &&
      (mention.end === text.length ||
        /[\s,，。.!！?？:：;；]/.test(text[mention.end]))
    );
  });
}
export function insertMention(
  text: string,
  mentions: ChatGroupMention[],
  member: Pick<ChatGroupParticipant, 'id' | 'name'>,
) {
  const match = text.match(/(^|\s)@[^\s@]*$/);
  const start = match
    ? text.length - match[0].length + match[1].length
    : text.length + (text && !/\s$/.test(text) ? 1 : 0);
  const prefix = match
    ? text.slice(0, start)
    : text + (start > text.length ? ' ' : '');
  const next = `${prefix}@${member.name} `;
  return {
    text: next,
    mentions: [
      ...editMentions(text, next, mentions).filter(
        (mention) => mention.end <= start,
      ),
      { participantId: member.id, start, end: start + member.name.length + 1 },
    ],
  };
}
export function hasUnboundMention(text: string, mentions: ChatGroupMention[]) {
  return [...text.matchAll(/(^|\s)@(?=\S)/g)].some((match) => {
    const start = match.index + match[1].length;
    return !mentions.some(
      (mention) => mention.start <= start && mention.end > start,
    );
  });
}
