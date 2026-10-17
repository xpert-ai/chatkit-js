import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSendTransition } from './send-transition';
import { createSendMorph } from './send-morph';

function fixture() {
  const viewport = document.createElement('div');
  viewport.dataset.chatkitRoot = '';
  viewport.innerHTML =
    '<div data-slot="chatkit-chat-content"><div data-row><div data-human-bubble><div data-human-bubble-content>Message</div></div></div></div><form><div role="textbox">Message</div></form>';
  document.body.append(viewport);
  const composer = viewport.querySelector('form');
  const input = composer?.querySelector<HTMLElement>('[role="textbox"]');
  const row = viewport.querySelector<HTMLElement>('[data-row]');
  const bubble = row?.querySelector<HTMLElement>('[data-human-bubble]');
  const content = bubble?.querySelector<HTMLElement>(
    '[data-human-bubble-content]',
  );
  if (!composer || !input || !row || !bubble || !content)
    throw new Error('Missing fixture elements');
  vi.spyOn(input, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(40, 500, 600, 40),
  );
  vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(40, 100, 600, 64),
  );
  vi.spyOn(bubble, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(400, 100, 240, 40),
  );
  Object.defineProperty(viewport, 'scrollHeight', { value: 1200 });
  const cancel = vi.fn();
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  const finished = { promise, resolve };
  const animate = vi
    .fn()
    .mockReturnValue({ cancel, finished: finished.promise });
  const cancelRebound = vi.fn();
  let finishRebound!: () => void;
  const reboundFinished = new Promise<void>((done) => {
    finishRebound = done;
  });
  const rebound = vi.fn().mockReturnValue({
    cancel: cancelRebound,
    finished: reboundFinished,
  });
  input.animate = animate;
  row.animate = animate;
  bubble.animate = rebound;
  const cancelContent = vi.fn();
  const counterTransform = vi
    .fn()
    .mockReturnValue({ cancel: cancelContent, finished: reboundFinished });
  content.animate = counterTransform;
  const preference = {
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(preference));
  const transition = createSendTransition(() => composer);
  return {
    viewport,
    row,
    input,
    transition,
    cancel,
    animate,
    preference,
    finished,
    rebound,
    cancelRebound,
    finishRebound,
    reboundFinished,
    counterTransform,
    cancelContent,
  };
}
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('composer send transition', () => {
  it('moves only the explicitly submitted message from its captured input position', async () => {
    const {
      transition,
      row,
      input,
      animate,
      viewport,
      finished,
      preference,
      rebound,
      finishRebound,
      reboundFinished,
      counterTransform,
    } = fixture();
    expect(transition.prepare('sent')).toBeTypeOf('function');
    // Clearing or moving the composer must not change the captured origin.
    input.textContent = '';
    vi.mocked(input.getBoundingClientRect).mockReturnValue(
      new DOMRect(0, 0, 20, 20),
    );
    transition.enter('historical', row);
    expect(animate).not.toHaveBeenCalled();
    transition.enter('sent', row);
    expect(viewport.scrollTop).toBe(1200);
    expect(animate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          transform: 'translate(-180px, 400px) scale(0.96)',
        }),
        expect.objectContaining({
          transform: 'translate(0, 0) scale(1)',
          opacity: 1,
        }),
      ]),
      expect.objectContaining({ duration: 320 }),
    );
    transition.enter('sent', row);
    expect(animate).toHaveBeenCalledOnce();
    expect(rebound).toHaveBeenCalledOnce();
    expect(counterTransform).toHaveBeenCalledOnce();
    expect(counterTransform.mock.calls[0][1]).toEqual(rebound.mock.calls[0][1]);
    expect(rebound.mock.calls[0][1].delay).toBeLessThan(
      animate.mock.calls[0][1].duration,
    );
    finished.resolve();
    await finished.promise;
    // The travel has finished, but reduced motion/unmount must still cancel the rebound.
    expect(preference.removeEventListener).not.toHaveBeenCalled();
    finishRebound();
    await reboundFinished;
    await Promise.resolve();
    expect(preference.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
    transition.clear();
  });

  it('discards failed, expired, hidden, and foreign-conversation sends', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { transition, row, animate, viewport } = fixture();
    transition.prepare('failed')?.();
    transition.enter('failed', row);
    transition.prepare('late');
    vi.advanceTimersByTime(2000);
    transition.enter('late', row);
    const transcript = viewport.querySelector<HTMLElement>(
      '[data-slot="chatkit-chat-content"]',
    );
    if (!transcript) throw new Error('Missing transcript');
    transcript.hidden = true;
    expect(transition.prepare('compact')).toBeUndefined();
    transcript.hidden = false;
    transition.enter('compact', row);
    transition.prepare('hidden-after-send');
    transcript.hidden = true;
    transition.enter('hidden-after-send', row);
    transcript.hidden = false;
    transition.prepare('foreign');
    const other = fixture();
    transition.enter('foreign', other.row);
    expect(animate).not.toHaveBeenCalled();
    expect(other.animate).not.toHaveBeenCalled();
    transition.clear();
    other.transition.clear();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts a long scrolled draft at the visible editor area', () => {
    const { transition, input, row, animate } = fixture();
    const editor = document.createElement('div');
    editor.dataset.slot = 'composer-body';
    input.replaceWith(editor);
    editor.append(input);
    vi.spyOn(editor, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(40, 500, 600, 128),
    );
    vi.mocked(input.getBoundingClientRect).mockReturnValue(
      new DOMRect(40, -200, 600, 800),
    );
    transition.prepare('long');
    transition.enter('long', row);
    expect(animate.mock.calls[0][0][0].transform).toBe(
      'translate(-180px, 400px) scale(0.96)',
    );
    transition.clear();
  });

  it('honors reduced motion and cancels in-flight animation when preference changes or Chat leaves', () => {
    const {
      transition,
      row,
      animate,
      preference,
      cancel,
      rebound,
      cancelRebound,
      cancelContent,
    } = fixture();
    preference.matches = true;
    expect(transition.prepare('reduced')).toBeUndefined();
    preference.matches = false;
    transition.prepare('first');
    preference.matches = true;
    transition.enter('first', row);
    expect(animate).not.toHaveBeenCalled();
    expect(rebound).not.toHaveBeenCalled();
    preference.matches = false;
    transition.prepare('second');
    transition.enter('second', row);
    preference.addEventListener.mock.calls[0][1]();
    expect(cancel).toHaveBeenCalledOnce();
    expect(cancelRebound).toHaveBeenCalledOnce();
    expect(cancelContent).toHaveBeenCalledOnce();
    transition.prepare('third');
    transition.enter('third', row);
    transition.clear();
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(cancelRebound).toHaveBeenCalledTimes(2);
    expect(cancelContent).toHaveBeenCalledTimes(2);
  });

  it.each([
    [60, 40],
    [700, 1000],
  ])(
    'flexes a %s × %s bubble without moving it or distorting its contents',
    (width, height) => {
      const morph = createSendMorph(width, height);
      const scales = (frame: Keyframe) =>
        String(frame.transform)
          .match(/^scale\(([^,]+), ([^)]+)\)$/)
          ?.slice(1)
          .map(Number);
      const widths = morph.surface.map((frame, index) => {
        const [x, y] = scales(frame) ?? [];
        const [contentX, contentY] = scales(morph.content[index]) ?? [];
        expect(x * y).toBeCloseTo(1, 8);
        expect(x * contentX).toBeCloseTo(1, 8);
        expect(y * contentY).toBeCloseTo(1, 8);
        expect(Math.abs(x - 1) * width).toBeLessThanOrEqual(12);
        expect(Math.abs(y - 1) * height).toBeLessThanOrEqual(6);
        return x;
      });
      expect(widths[0]).toBe(1);
      expect(widths.at(-1)).toBe(1);
      expect(Math.max(...widths)).toBeGreaterThan(1);
      expect(Math.min(...widths)).toBeLessThan(1);
      expect(1 - Math.min(...widths)).toBeLessThan(Math.max(...widths) - 1);
    },
  );
});
