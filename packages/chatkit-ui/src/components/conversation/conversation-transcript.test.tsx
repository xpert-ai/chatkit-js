import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client, type ChatMessage } from '@xpert-ai/xpert-sdk';
import type { ChatKitAIMessage } from '../../providers/stream/types';
import {
  downloadConversation,
  markdownToText,
  readConversationTranscript,
  serializeConversation,
} from './conversation-transcript';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const target = { recordId: 'record', id: 'secondary-thread' };

describe('conversation transcript', () => {
  it('reads all pages of the selected branch and preserves chronological order', async () => {
    const client = new Client({ apiUrl: 'https://example.invalid' });
    const records: ChatMessage[] = Array.from({ length: 53 }, (_, i) => ({
      id: String(i),
      role: i % 2 ? 'assistant' : 'user',
      content: `Message ${i}`,
      createdAt: new Date(i * 1000).toISOString(),
    })).reverse();
    const search = vi
      .spyOn(client.conversations, 'searchMessages')
      .mockImplementation(async (_id, query) => ({
        items: records.slice(query?.offset ?? 0, (query?.offset ?? 0) + 50),
        total: 53,
      }));
    const controller = new AbortController();
    const result = await readConversationTranscript(
      client,
      target,
      controller.signal,
    );
    expect(result.map((message) => message.id)).toEqual(
      Array.from({ length: 53 }, (_, i) => String(i)),
    );
    expect(search).toHaveBeenCalledTimes(2);
    expect(search).toHaveBeenLastCalledWith(
      'record',
      expect.objectContaining({
        where: { threadId: 'secondary-thread' },
        offset: 50,
      }),
      { signal: controller.signal },
    );
  });

  it.each(['empty', 'duplicate', 'changed'] as const)(
    'rejects %s pagination instead of exporting a partial conversation',
    async (failure) => {
      const client = new Client({ apiUrl: 'https://example.invalid' });
      vi.spyOn(client.conversations, 'searchMessages')
        .mockResolvedValueOnce({
          items: [{ id: 'one', role: 'user', content: 'first' }],
          total: 2,
        })
        .mockResolvedValueOnce({
          items:
            failure === 'empty'
              ? []
              : [
                  {
                    id: failure === 'duplicate' ? 'one' : 'two',
                    role: 'assistant',
                    content: 'second',
                  },
                ],
          total: failure === 'changed' ? 3 : 2,
        });
      await expect(
        readConversationTranscript(
          client,
          target,
          new AbortController().signal,
        ),
      ).rejects.toThrow();
    },
  );

  it('does not continue fetching after cancellation', async () => {
    const client = new Client({ apiUrl: 'https://example.invalid' });
    const controller = new AbortController();
    const search = vi
      .spyOn(client.conversations, 'searchMessages')
      .mockImplementation(async () => {
        controller.abort();
        return { items: [{ id: 'one' }], total: 100 };
      });
    await expect(
      readConversationTranscript(client, target, controller.signal),
    ).rejects.toThrow('cancelled');
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('exports only user and assistant text, excluding reasoning, tools and attachment payloads', () => {
    const messages: ChatKitAIMessage[] = [
      {
        type: 'human',
        content: 'Question',
        attachments: [
          { originalName: 'private.pdf', token: 'secret-file-token' },
        ],
      },
      { type: 'system', content: 'hidden-system' },
      { type: 'tool', content: 'hidden-tool' },
      {
        type: 'ai',
        content: [
          { type: 'text', text: '**Answer**' },
          { type: 'reasoning', text: 'hidden-reasoning' },
          {
            type: 'image_url',
            image_url: { url: 'https://private.invalid/?token=secret' },
          },
        ],
      },
    ];
    const markdown = serializeConversation('Report', messages, 'markdown', {
      user: 'User',
      assistant: 'Assistant',
      textOnly: 'Text only',
    });
    expect(markdown).toContain('## Assistant\n\n**Answer**');
    expect(markdown).not.toMatch(/hidden-|secret|private\.invalid/);
    const plain = serializeConversation('Report', messages, 'text', {
      user: 'User',
      assistant: 'Assistant',
      textOnly: 'Text only',
    });
    expect(plain).toContain('Assistant\nAnswer');
    expect(plain).not.toContain('**');
  });

  it('turns rich Markdown into readable text without executing HTML', () => {
    const result = markdownToText(
      '# Heading\n\nHello **world** & friends.\n\n- First\n- Second\n\n```js\nlet x = 1;\n```\n\n[Link](https://example.com)\n\n<script>alert(1)</script>',
    );
    expect(result).toContain('Heading\n');
    expect(result).toContain('Hello world & friends.');
    expect(result).toMatch(/First\n+Second/);
    expect(result).toContain('let x = 1;');
    expect(result).not.toContain('alert(1)');
  });

  it('downloads actual UTF-8 Markdown bytes and uses a safe filename', async () => {
    let blob: Blob | undefined;
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL(value: Blob) {
          blob = value;
          return 'blob:export';
        }
        static revokeObjectURL = vi.fn();
      },
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('报价_分析.md');
        expect(this.getAttribute('href')).toBe('blob:export');
      });
    downloadConversation('报价/分析', '# 报价\n\n✓ 完成');
    expect(click).toHaveBeenCalledOnce();
    expect(blob?.type).toBe('text/markdown;charset=utf-8');
    expect(await blob?.text()).toBe('# 报价\n\n✓ 完成');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
