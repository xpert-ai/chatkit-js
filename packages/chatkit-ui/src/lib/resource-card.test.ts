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
  const images = ['one', 'two'].map((id) => ({
    id,
    title: id,
    alt: `${id} image`,
    file: {
      viewKey: 'bid.view-provider__bid.studio',
      fileKey: 'bid-project-image',
      targetId: `project:${id}`,
    },
  }));
  it('preserves mixed blocks in order across streaming, persistence and repeat emissions', () => {
    const content = createResourceCardContent({
      ...card,
      content: [
        { kind: 'fields', fields: [{ label: '状态', value: '已验收' }] },
        { kind: 'image-gallery', title: '施工图', images },
        {
          kind: 'file-list',
          files: [{ ...images[0], description: '设计说明' }],
        },
      ],
    });
    const restored = parseResourceCardContent(
      JSON.parse(JSON.stringify(content)),
    );
    expect(restored).toEqual(content);
    expect(upsertResourceCardContent([content], restored!)).toEqual([content]);
    const message = applyResourceCard(
      [{ id: 'reply', type: 'assistant', content: '' }],
      { ...content, messageId: 'reply' },
    )[0];
    expect(message.content).toContainEqual(
      expect.objectContaining({ data: content.data }),
    );
    expect(restored?.data.content?.map((block) => block.kind)).toEqual([
      'fields',
      'image-gallery',
      'file-list',
    ]);
    expect(JSON.stringify(restored)).not.toContain('base64');
  });
  it('migrates historical images at the read boundary and prefers explicit content', () => {
    expect(parseResourceCard({ ...card, images })?.content).toEqual([
      { kind: 'image-gallery', images },
    ]);
    expect(parseResourceCard({ ...card, images })).not.toHaveProperty('images');
    expect(parseResourceCard({ ...card, images, content: [] })).toEqual(card);
  });
  it.each(
    [
      [{ id: 'one', title: 'Image', file: { viewKey: 'v', fileKey: 'f' } }],
      [
        {
          id: 'one',
          title: 'Image',
          file: {
            viewKey: 'v',
            fileKey: 'f',
            targetId: 'id',
            url: 'https://private',
          },
        },
      ],
      [
        {
          id: 'one',
          title: 'Image',
          file: { viewKey: 'v', fileKey: 'f', targetId: 'id' },
        },
        {
          id: 'one',
          title: 'Duplicate',
          file: { viewKey: 'v', fileKey: 'f', targetId: 'id' },
        },
      ],
      new Array(101).fill(null),
    ].map((images) => ({ images })),
  )('ignores invalid image blocks but retains navigation: %j', ({ images }) => {
    expect(
      parseResourceCard({
        ...card,
        content: [{ kind: 'image-gallery', images }],
      }),
    ).toEqual(card);
  });
  it('ignores unknown and malformed blocks without losing valid neighbors', () => {
    const fields = {
      kind: 'fields',
      fields: [{ label: '状态', value: '已验收' }],
    };
    expect(
      parseResourceCard({
        ...card,
        content: [
          { kind: 'future-widget', payload: 'future' },
          {
            kind: 'file-list',
            files: [
              { ...images[0], file: { ...images[0].file, token: 'secret' } },
            ],
          },
          fields,
          { kind: 'fields', fields: [{ label: 'count', value: {} }] },
        ],
      }),
    ).toEqual({ ...card, content: [fields] });
  });
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
