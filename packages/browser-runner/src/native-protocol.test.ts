import { describe, expect, it } from 'vitest';

import {
  NativeMessageDecoder,
  encodeNativeMessage,
} from './native-protocol.js';

describe('native messaging protocol', () => {
  it('decodes fragmented and batched length-prefixed messages', () => {
    const first = encodeNativeMessage({ requestId: '1', command: 'status' });
    const second = encodeNativeMessage({ requestId: '2', command: 'stop' });
    const bytes = Buffer.concat([first, second]);
    const decoder = new NativeMessageDecoder();

    expect(decoder.push(bytes.subarray(0, 5))).toEqual([]);
    expect(decoder.push(bytes.subarray(5))).toEqual([
      { requestId: '1', command: 'status' },
      { requestId: '2', command: 'stop' },
    ]);
  });

  it('rejects oversized native messages before allocating their payload', () => {
    const header = Buffer.alloc(4);
    header.writeUInt32LE(2 * 1024 * 1024, 0);

    expect(() => new NativeMessageDecoder().push(header)).toThrow(
      'exceeds the 1 MiB limit',
    );
  });
});
