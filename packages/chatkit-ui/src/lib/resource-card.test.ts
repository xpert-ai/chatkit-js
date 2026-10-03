import { describe, expect, it } from 'vitest';
import {
  createResourceCardContent,
  parseResourceCard,
  parseResourceCardContent,
  upsertResourceCardContent,
  type ConversationResourceCard,
} from '@xpert-ai/chatkit-types';
import { applyResourceCard } from './stream-resource-card';
import { isNonTranscriptMessageContent } from './message-content-presentation';
import { getFinalAnswerText } from './assistant-presentation';

const card: ConversationResourceCard = {
  resource: { namespace: 'platform', type: 'project', id: 'p' },
  title: 'Project',
  open: {
    target: 'assistant.project',
    projectId: 'p',
    viewKey: 'platform.project-tasks__timeline',
    parameters: { zoom: 2, tags: ['a'] },
  },
};

describe('resource-card protocol', () => {
  it('preserves typed project navigation and scalar queries', () => {
    expect(parseResourceCard(card)).toEqual(card);
    expect(
      parseResourceCard({
        ...card,
        open: {
          target: 'workbench.view',
          viewKey: 'scheduler',
          selectionId: 't',
        },
      })?.open,
    ).toEqual({
      target: 'workbench.view',
      viewKey: 'scheduler',
      selectionId: 't',
    });
  });
  it.each([
    { target: 'javascript', viewKey: 'v' },
    { target: 'assistant.project', viewKey: 'v' },
    { target: 'workbench.view', viewKey: 'v', url: 'javascript:alert(1)' },
    { target: 'workbench.view', viewKey: 'v', parameters: { nested: {} } },
    {
      target: 'workbench.view',
      viewKey: 'v',
      parameters: { invalid: Infinity },
    },
  ])('rejects invalid navigation %j', (open) =>
    expect(parseResourceCard({ ...card, open })).toBeNull(),
  );
  it('canonicalizes identity and strips fields outside the public contract', () => {
    const content = createResourceCardContent(card);
    expect(
      parseResourceCardContent({ ...content, id: 'forged', script: 'execute' }),
    ).toEqual(content);
    expect(parseResourceCard({ ...card, token: 'secret' })).toEqual(card);
  });
  it('replaces the resource within one reply while preserving text and order', () => {
    const first = createResourceCardContent(card),
      second = createResourceCardContent({ ...card, title: 'Updated' });
    const text = { type: 'text', text: 'Done' };
    expect(upsertResourceCardContent([text, first], second)).toEqual([
      text,
      second,
    ]);
  });
  it('routes delayed cards to their owning message and rejects unbound events', () => {
    const messages = [
      { id: 'first', type: 'ai', content: 'Created' },
      { id: 'second', type: 'ai', content: 'Other reply' },
    ];
    const content = createResourceCardContent(card);
    expect(applyResourceCard(messages, content)).toEqual(messages);
    const updated = applyResourceCard(messages, {
      ...content,
      messageId: 'first',
    });
    expect(updated[1]).toEqual(messages[1]);
    expect(updated[0].content).toEqual([
      { type: 'text', text: 'Created' },
      { ...content, messageId: 'first' },
    ]);
  });
  it('keeps cards outside transcript process grouping and final answer text', () => {
    const content = createResourceCardContent(card);
    expect(isNonTranscriptMessageContent(content)).toBe(true);
    expect(
      getFinalAnswerText({
        id: 'reply',
        type: 'assistant',
        status: 'success',
        content: [content, { type: 'text', text: 'Created.' }],
      }),
    ).toBe('Created.');
  });
});
