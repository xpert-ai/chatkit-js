import { describe, expect, it, vi } from 'vitest';
import { FileReadQueue } from './file-read-queue';

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe('file read scheduling', () => {
  it('bounds concurrency and starts an opened original before queued thumbnails', async () => {
    const queue = new FileReadQueue<string>(2);
    const finish = new Map<string, (value: string) => void>();
    const started: string[] = [];
    const read = (key: string, priority = 1) =>
      queue.read(
        key,
        new AbortController().signal,
        async () => {
          started.push(key);
          return new Promise<string>((resolve) => finish.set(key, resolve));
        },
        priority,
      );
    const a = read('a');
    const b = read('b');
    await flush();
    const c = read('thumbnail');
    const d = read('original', 0);
    await flush();
    expect(started).toEqual(['a', 'b']);
    finish.get('a')!('a');
    await a;
    await flush();
    expect(started).toEqual(['a', 'b', 'original']);
    finish.get('b')!('b');
    await b;
    await flush();
    finish.get('original')!('original');
    finish.get('thumbnail')!('thumbnail');
    await Promise.all([c, d]);
  });

  it('shares only pending reads and cancelling one consumer leaves another active', async () => {
    const queue = new FileReadQueue<string>();
    let finish!: (value: string) => void;
    const load = vi.fn(
      (signal: AbortSignal) =>
        new Promise<string>((resolve) => {
          finish = resolve;
          expect(signal.aborted).toBe(false);
        }),
    );
    const first = new AbortController();
    const a = queue.read('file', first.signal, load);
    const b = queue.read('file', new AbortController().signal, load);
    await flush();
    const rejected = expect(a).rejects.toMatchObject({ name: 'AbortError' });
    first.abort();
    await rejected;
    expect(load.mock.calls[0][0].aborted).toBe(false);
    finish('bytes');
    expect(await b).toBe('bytes');
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(
      await queue.read('file', new AbortController().signal, async () => 'new'),
    ).toBe('new');
  });

  it('does not send discarded effects or cancelled queued requests', async () => {
    const queue = new FileReadQueue<string>();
    const abort = new AbortController();
    const load = vi.fn(async () => 'bytes');
    const read = queue.read('file', abort.signal, load);
    const rejected = expect(read).rejects.toMatchObject({ name: 'AbortError' });
    abort.abort();
    await rejected;
    await flush();
    expect(load).not.toHaveBeenCalled();
    expect(await queue.read('file', new AbortController().signal, load)).toBe(
      'bytes',
    );
  });

  it('releases a failed slot and permits a fresh authorized retry', async () => {
    const queue = new FileReadQueue<string>(1);
    const a = queue.read('file', new AbortController().signal, async () => {
      throw new Error('Denied');
    });
    const b = queue.read(
      'next',
      new AbortController().signal,
      async () => 'next',
    );
    await expect(a).rejects.toThrow('Denied');
    expect(await b).toBe('next');
    expect(
      await queue.read(
        'file',
        new AbortController().signal,
        async () => 'retry',
      ),
    ).toBe('retry');
  });
});
