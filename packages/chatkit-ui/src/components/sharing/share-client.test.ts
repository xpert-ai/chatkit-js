import { describe, it, expect, vi } from 'vitest';
import { Client } from '@xpert-ai/xpert-sdk';
import { supportsConversationSharing } from './share-client';

describe('sharing SDK capability compatibility', () => {
  it('enables sharing with the installed SDK package', () => {
    const client = new Client({ apiUrl: 'https://api.example/api/ai' });
    expect(supportsConversationSharing(client)).toBe(true);
  });
  it('hides the action for older or partially upgraded SDKs', () => {
    const old = { conversations: { get: vi.fn() } } as unknown as Client;
    expect(supportsConversationSharing(old)).toBe(false);
    const partial = {
      conversations: { previewShare: vi.fn() },
    } as unknown as Client;
    expect(supportsConversationSharing(partial)).toBe(false);
  });
  it('accepts the complete SDK sharing API', () => {
    const client = {
      conversations: {
        previewShare: vi.fn(),
        createShare: vi.fn(),
        listShares: vi.fn(),
        revokeShare: vi.fn(),
      },
    } as unknown as Client;
    expect(supportsConversationSharing(client)).toBe(true);
  });
});
