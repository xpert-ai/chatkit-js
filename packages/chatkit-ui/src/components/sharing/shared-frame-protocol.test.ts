import { describe, expect, it } from 'vitest';
import { readSharedFrameEvent } from './shared-frame-protocol';

const channelId = '08a67bc2-99bd-4a86-aeae-8368f1097767';
const origin = 'https://xpert.example';
const data = {
  type: 'chatkit:shared-transcript',
  channelId,
  snapshot: {
    messages: [{ role: 'ai', text: 'Shared answer' }],
    expiresAt: '2030-01-01T00:00:00.000Z',
  },
  locale: 'zh-CN',
  theme: { colorScheme: 'dark', radius: 'sharp', density: 'compact' },
};
const event = (
  value: unknown = data,
  source: Window | null = window,
  from = origin,
) => new MessageEvent('message', { source, origin: from, data: value });

describe('shared renderer boundary', () => {
  it('accepts an exact export from the bound parent and channel', () => {
    expect(readSharedFrameEvent(event(), window, origin, channelId)).toEqual(
      data,
    );
  });
  it('rejects wrong sources, origins and channels', () => {
    expect(
      readSharedFrameEvent(event(data, null), window, origin, channelId),
    ).toBeNull();
    expect(
      readSharedFrameEvent(
        event(data, window, 'https://other.example'),
        window,
        origin,
        channelId,
      ),
    ).toBeNull();
    expect(
      readSharedFrameEvent(
        event({ ...data, channelId: crypto.randomUUID() }),
        window,
        origin,
        channelId,
      ),
    ).toBeNull();
  });
  it('rejects live credentials, resource payloads, invalid expiry and oversized snapshots', () => {
    for (const value of [
      { ...data, token: 'private' },
      {
        ...data,
        snapshot: {
          ...data.snapshot,
          messages: [{ role: 'ai', text: 'answer', tool_calls: [] }],
        },
      },
      { ...data, snapshot: { ...data.snapshot, expiresAt: 'invalid' } },
      {
        ...data,
        snapshot: {
          ...data.snapshot,
          messages: [{ role: 'ai', text: 'x'.repeat(1024 * 1024) }],
        },
      },
    ])
      expect(
        readSharedFrameEvent(event(value), window, origin, channelId),
      ).toBeNull();
  });
});
