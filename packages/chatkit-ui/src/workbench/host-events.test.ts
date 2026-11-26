import { describe, expect, it } from 'vitest';
import {
  CHATKIT_INTERNAL_PARENT_EVENT,
  matchesHostEventSubscription,
  normalizeChatKitHostEvent,
} from './host-events';

describe('workbench host events', () => {
  it.each([
    ['lg.tool.start', 'assistant.tool.started'],
    ['lg.tool.end', 'assistant.tool.completed'],
    ['lg.tool.error', 'assistant.tool.failed'],
  ])('preserves canonical scope and identity for %s', (name, type) => {
    const event = new CustomEvent(CHATKIT_INTERNAL_PARENT_EVENT, {
      detail: {
        event: 'public_event',
        data: [
          'log',
          {
            name,
            data: {
              toolName: 'uose-getEntityNeighborhood',
              toolCallId: 'call-1',
              threadId: 'branch-1',
              conversationId: 'conversation-1',
            },
          },
        ],
      },
    });
    const normalized = normalizeChatKitHostEvent(event, 'stale-branch');
    expect(normalized).toMatchObject({
      type,
      threadId: 'branch-1',
      toolCallId: 'call-1',
      data: { conversationId: 'conversation-1' },
    });
    expect(normalizeChatKitHostEvent(event)?.id).toBe(normalized?.id);
  });

  it('does not overwrite lifecycle events with presentation component logs', () => {
    for (const status of ['running', 'success', 'fail']) {
      const event = new CustomEvent(CHATKIT_INTERNAL_PARENT_EVENT, {
        detail: {
          event: 'public_event',
          data: [
            'log',
            {
              name: 'component',
              id: 'call-1',
              data: {
                category: 'Tool',
                toolPresentation: 'redacted',
                tool: 'uose-getEntityNeighborhood',
                status,
              },
            },
          ],
        },
      });
      expect(normalizeChatKitHostEvent(event)).toBeNull();
    }
  });

  it('normalizes completed tool logs', () => {
    const event = new CustomEvent(CHATKIT_INTERNAL_PARENT_EVENT, {
      detail: {
        event: 'public_event',
        data: [
          'log',
          {
            name: 'lg.tool.end',
            data: {
              toolName: 'knowledge_search',
              toolCallId: 'call-1',
              durationMs: 42,
              output: { documentId: 'doc-1' },
              _meta: { secret: 'removed' },
            },
          },
        ],
      },
    });

    const normalized = normalizeChatKitHostEvent(event, 'thread-1');
    expect(normalized).toMatchObject({
      type: 'assistant.tool.completed',
      source: 'chatkit',
      threadId: 'thread-1',
      toolName: 'knowledge_search',
      toolCallId: 'call-1',
      durationMs: 42,
      data: {
        output: { documentId: 'doc-1' },
      },
    });
    expect(normalized?.data).not.toHaveProperty('_meta');
  });

  it('normalizes citation effects and applies manifest filters', () => {
    const event = new CustomEvent(CHATKIT_INTERNAL_PARENT_EVENT, {
      detail: {
        event: 'public_event',
        data: [
          'effect',
          {
            name: 'knowledgebase.open_citation',
            data: { documentId: 'doc-1', page: 2 },
          },
        ],
      },
    });
    const normalized = normalizeChatKitHostEvent(event);
    expect(normalized).toMatchObject({
      type: 'assistant.citation.open',
      source: 'chatkit',
      data: { documentId: 'doc-1', page: 2 },
    });
    if (!normalized) return;

    expect(
      matchesHostEventSubscription(normalized, {
        key: 'citation',
        event: 'assistant.citation.open',
        filter: { sources: ['chatkit'] },
      }),
    ).toBe(true);
    expect(
      matchesHostEventSubscription(normalized, {
        key: 'other-source',
        event: 'assistant.citation.open',
        filter: { sources: ['cloud'] },
      }),
    ).toBe(false);
  });
});
