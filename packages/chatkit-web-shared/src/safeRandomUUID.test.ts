import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSecureChannelId, safeRandomUUID } from './safeRandomUUID';

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('secure UUID generation', () => {
  it('uses the native method with its Crypto receiver when available', () => {
    const id = '6a527294-67ed-4b5f-a6b7-cb5a760a022b';
    const randomUUID = vi.fn(function (this: unknown) {
      expect(this).toBe(globalThis.crypto);
      return id;
    });
    const getRandomValues = vi.fn();
    vi.stubGlobal('crypto', { randomUUID, getRandomValues });

    expect(safeRandomUUID()).toBe(id);
    expect(randomUUID).toHaveBeenCalledOnce();
    expect(getRandomValues).not.toHaveBeenCalled();
  });

  it('sets RFC UUID v4 version and variant bits in fallback bytes', () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => bytes.fill(0xff));
    vi.stubGlobal('crypto', { getRandomValues });

    expect(safeRandomUUID()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    expect(getRandomValues).toHaveBeenCalledOnce();
    expect(getRandomValues.mock.calls[0][0]).toHaveLength(16);
  });

  it('generates distinct UUIDs with real secure random bytes when randomUUID is absent', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
    });
    const weakRandom = vi.spyOn(Math, 'random');
    const ids = Array.from({ length: 100 }, () => safeRandomUUID());

    expect(ids.every((id) => uuidV4.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(weakRandom).not.toHaveBeenCalled();
  });

  it.each([undefined, {}, { randomUUID: true }])(
    'fails closed without a secure random source (%j)',
    (crypto) => {
      vi.stubGlobal('crypto', crypto);
      const weakRandom = vi.spyOn(Math, 'random');

      expect(createSecureChannelId()).toBeNull();
      expect(safeRandomUUID).toThrow(
        'ChatKit requires crypto.randomUUID or crypto.getRandomValues',
      );
      expect(weakRandom).not.toHaveBeenCalled();
    },
  );
});
