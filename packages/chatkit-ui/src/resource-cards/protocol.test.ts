import { describe, expect, expectTypeOf, it } from 'vitest';
import type * as SDK from '@xpert-ai/xpert-sdk';
import {
  parseResourceCardContent,
  type ConversationResourceCard,
  type ResourceCardContent,
  type ResourceCardOpenTarget,
  type TMessageContentResourceCard,
} from '@xpert-ai/chatkit-types';

const file = {
  viewKey: 'provider.library',
  fileKey: 'original',
  targetId: 'v1',
};
const blocks: SDK.ResourceCardContent[] = [
  {
    kind: 'fields',
    title: 'Summary',
    fields: [{ label: 'Status', value: 'Ready' }],
  },
  {
    kind: 'image-gallery',
    images: [{ id: 'image', title: 'Layout', alt: 'Site', file }],
  },
  {
    kind: 'file-list',
    files: [{ id: 'file', title: 'Report', description: 'Original', file }],
  },
];
const targets: SDK.ResourceCardOpenTarget[] = [
  {
    target: 'workbench.view',
    viewKey: file.viewKey,
    selectionId: 'item',
    parameters: { tab: 'images' },
  },
  { target: 'assistant.project', viewKey: file.viewKey, projectId: 'project' },
  {
    target: 'workbench.file',
    ...file,
    previewFile: { ...file, fileKey: 'pdf' },
  },
];

describe('published SDK / ChatKit resource-card contract', () => {
  it('keeps producer and consumer wire types compatible in both directions', () => {
    expectTypeOf<SDK.ResourceCardContent>().toEqualTypeOf<ResourceCardContent>();
    expectTypeOf<SDK.ResourceCardOpenTarget>().toEqualTypeOf<ResourceCardOpenTarget>();
    expectTypeOf<SDK.ConversationResourceCard>().toMatchTypeOf<ConversationResourceCard>();
    expectTypeOf<ConversationResourceCard>().toMatchTypeOf<SDK.ConversationResourceCard>();
    expectTypeOf<SDK.TMessageContentResourceCard>().toMatchTypeOf<TMessageContentResourceCard>();
    expectTypeOf<TMessageContentResourceCard>().toMatchTypeOf<SDK.TMessageContentResourceCard>();
  });

  it.each(targets)(
    'preserves SDK messages through JSON/history parsing: $target',
    (open) => {
      const message: SDK.TMessageContentResourceCard = {
        type: 'resource_card',
        id: JSON.stringify(['example', 'delivery', 'v1']),
        messageId: 'reply',
        executionId: 'run',
        data: {
          resource: { namespace: 'example', type: 'delivery', id: 'v1' },
          title: 'Delivery',
          description: 'Ready',
          content: blocks,
          open,
        },
      };
      expect(
        parseResourceCardContent(JSON.parse(JSON.stringify(message))),
      ).toEqual(message);
    },
  );
});
