const MAX_NATIVE_MESSAGE_BYTES = 1024 * 1024;

export function encodeNativeMessage(value: unknown): Buffer {
  const payload = Buffer.from(JSON.stringify(value), 'utf8');
  if (payload.length > MAX_NATIVE_MESSAGE_BYTES) {
    throw new Error('Native message exceeds the 1 MiB limit.');
  }
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

export class NativeMessageDecoder {
  private buffer = Buffer.alloc(0);

  push(chunk: Uint8Array): unknown[] {
    this.buffer = Buffer.concat([this.buffer, Buffer.from(chunk)]);
    const messages: unknown[] = [];

    while (this.buffer.length >= 4) {
      const length = this.buffer.readUInt32LE(0);
      if (length > MAX_NATIVE_MESSAGE_BYTES) {
        throw new Error('Native message exceeds the 1 MiB limit.');
      }
      if (this.buffer.length < length + 4) {
        break;
      }
      const payload = this.buffer.subarray(4, length + 4);
      this.buffer = this.buffer.subarray(length + 4);
      messages.push(JSON.parse(payload.toString('utf8')));
    }

    return messages;
  }
}
