import { createSendMorph } from './send-morph';

type Origin = {
  rect: DOMRect;
  viewport: HTMLElement;
  expires: ReturnType<typeof setTimeout>;
};

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const TRAVEL_DURATION = 320;

/** Per-Chat, ephemeral presentation state; nothing is added to persisted messages. */
export function createSendTransition(getComposer: () => HTMLElement | null) {
  const pending = new Map<string, Origin>();
  const running = new Map<string, () => void>();
  const forget = (id: string) => {
    const origin = pending.get(id);
    if (origin) clearTimeout(origin.expires);
    pending.delete(id);
  };
  const cancel = (id: string) => {
    forget(id);
    running.get(id)?.();
  };
  const prepare = (id?: string) => {
    if (!id || window.matchMedia?.(REDUCED_MOTION).matches) return;
    const composer = getComposer();
    const viewport = composer?.closest<HTMLElement>('[data-chatkit-root]');
    const input = composer?.querySelector<HTMLElement>('[role="textbox"]');
    const transcript = viewport?.querySelector<HTMLElement>(
      '[data-slot="chatkit-chat-content"]',
    );
    let rect = input?.getBoundingClientRect();
    const editor = input
      ?.closest('[data-slot="composer-body"]')
      ?.getBoundingClientRect();
    if (rect && editor?.width && editor.height) {
      // A long draft scrolls inside the editor. Start at the visible text,
      // rather than its offscreen first line.
      const left = Math.max(rect.left, editor.left);
      const top = Math.max(rect.top, editor.top);
      rect = new DOMRect(
        left,
        top,
        Math.max(0, Math.min(rect.right, editor.right) - left),
        Math.max(0, Math.min(rect.bottom, editor.bottom) - top),
      );
    }
    if (
      !viewport ||
      !rect?.width ||
      !rect.height ||
      typeof input?.animate !== 'function' ||
      transcript?.hidden ||
      composer?.closest('[hidden]')
    )
      return;
    cancel(id);
    pending.set(id, {
      rect,
      viewport,
      // Queued, late, or reloaded messages must never replay a send animation.
      expires: setTimeout(() => forget(id), 2000),
    });
    return () => cancel(id);
  };
  const enter = (id: string, row: HTMLElement) => {
    const origin = pending.get(id);
    forget(id);
    if (
      !origin ||
      row.closest('[data-chatkit-root]') !== origin.viewport ||
      row.closest('[hidden]') ||
      typeof row.animate !== 'function'
    )
      return;
    const preference = window.matchMedia?.(REDUCED_MOTION);
    if (preference?.matches) return;
    const bubble = row.querySelector<HTMLElement>('[data-human-bubble]');
    if (!bubble?.getBoundingClientRect().width) return;

    // Settle the destination before measuring; smooth scrolling would otherwise
    // compete with the send motion, especially on the first message.
    origin.viewport.scrollTop = origin.viewport.scrollHeight;
    const target = bubble.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const x =
      origin.rect.left +
      origin.rect.width / 2 -
      (target.left + target.width / 2);
    const y = origin.rect.top - target.top;
    const transformOrigin = `${target.left + target.width / 2 - rowRect.left}px ${target.top - rowRect.top}px`;
    const travel = row.animate(
      [
        {
          transform: `translate(${x}px, ${y}px) scale(0.96)`,
          opacity: 0.2,
          transformOrigin,
          zIndex: 20,
        },
        { opacity: 1, offset: 0.35, transformOrigin, zIndex: 20 },
        {
          transform: 'translate(0, 0) scale(1)',
          opacity: 1,
          transformOrigin,
          zIndex: 20,
        },
      ],
      { duration: TRAVEL_DURATION, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
    const morph = createSendMorph(target.width, target.height);
    // Blend deformation into arrival instead of stopping and then jumping again.
    const timing = { delay: TRAVEL_DURATION - 64, duration: morph.duration };
    const animations = [travel, bubble.animate(morph.surface, timing)];
    const content = bubble.querySelector<HTMLElement>(
      '[data-human-bubble-content]',
    );
    if (content) animations.push(content.animate(morph.content, timing));
    const cleanup = () => {
      if (running.get(id) !== stop) return;
      running.delete(id);
      preference?.removeEventListener('change', stop);
    };
    const stop = () => {
      cleanup();
      for (const animation of animations) animation.cancel();
    };
    running.set(id, stop);
    preference?.addEventListener('change', stop);
    void Promise.all(animations.map((animation) => animation.finished)).then(
      cleanup,
      cleanup,
    );
    return stop;
  };
  return {
    prepare,
    enter,
    clear: () => {
      for (const id of pending.keys()) forget(id);
      for (const stop of running.values()) stop();
    },
  };
}
