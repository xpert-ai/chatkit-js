import { describe, expect, it, vi } from 'vitest';
import type { Client } from '@xpert-ai/xpert-sdk';

import {
  getConversationConnectorBindingIds,
  persistConversationConnectorBindingIds,
  withConnectorBindingIds,
} from './conversation-connectors';

describe('conversation Connector selection', () => {
  it('normalizes persisted binding ids', () => {
    const options = withConnectorBindingIds(undefined, [
      ' binding-1 ',
      'binding-1',
      'binding-2',
    ]);

    expect(options.runtimeCapabilities?.inheritUnselected).toBe(true);

    expect(
      getConversationConnectorBindingIds({
        id: 'conversation-1',
        threadId: 'thread-1',
        options,
      }),
    ).toEqual(['binding-1', 'binding-2']);
  });

  it('updates only the conversation runtime Connector selection', async () => {
    const update = vi.fn().mockResolvedValue({});
    const client = { conversations: { update } } as unknown as Client<unknown>;

    await persistConversationConnectorBindingIds({
      client,
      conversation: {
        id: 'conversation-1',
        threadId: 'thread-1',
        options: {
          marker: 'keep',
          runtimeCapabilities: {
            mode: 'allowlist',
            skills: { ids: ['skill-1'] },
            plugins: { nodeKeys: [] },
          },
        },
      },
      bindingIds: ['binding-1'],
    });

    expect(update).toHaveBeenCalledWith('conversation-1', {
      options: {
        marker: 'keep',
        runtimeCapabilities: {
          mode: 'allowlist',
          skills: { ids: ['skill-1'] },
          plugins: { nodeKeys: [] },
          connectors: { bindingIds: ['binding-1'] },
        },
      },
    });
  });
});
