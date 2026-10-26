import type { XpertViewFileAccessGrantResult } from '@xpert-ai/xpert-sdk';
import { FileReadQueue } from '../../lib/files/file-read-queue';

const queues = new WeakMap<
  object,
  FileReadQueue<XpertViewFileAccessGrantResult>
>();

/** Remote Views retain grants; limit the entire grant/read flow rather than each HTTP leg. */
export function readRemoteFile(
  client: object,
  key: string,
  signal: AbortSignal,
  read: (signal: AbortSignal) => Promise<XpertViewFileAccessGrantResult>,
  download: boolean,
) {
  let queue = queues.get(client);
  if (!queue) {
    queue = new FileReadQueue();
    queues.set(client, queue);
  }
  return queue.read(key, signal, read, download ? 0 : 1);
}
