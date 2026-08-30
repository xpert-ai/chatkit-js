import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PET_STORAGE_KEY } from '@xpert-ai/chatkit-types';
import { PetOverlay } from './PetOverlay';

type PointerEventInitWithId = MouseEventInit & {
  pointerId: number;
  pointerType?: string;
};

function dispatchPointerEvent(
  target: EventTarget,
  type: string,
  init: PointerEventInitWithId,
): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    ...init,
  }) as PointerEvent;
  Object.defineProperties(event, {
    pointerId: { value: init.pointerId },
    pointerType: { value: init.pointerType ?? 'mouse' },
  });
  target.dispatchEvent(event);
  return event;
}

describe('PetOverlay dragging', () => {
  let overlay: PetOverlay;
  let pet: HTMLDivElement;
  let hasCapture: boolean;
  let setPointerCapture: ReturnType<typeof vi.fn>;
  let releasePointerCapture: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 800,
    });

    const host = document.createElement('div');
    document.body.append(host);
    overlay = new PetOverlay(host.attachShadow({ mode: 'open' }));
    overlay.setOptions(true);

    const renderedPet = host.shadowRoot?.querySelector<HTMLDivElement>(
      '[data-chatkit-host-pet]',
    );
    if (!renderedPet) {
      throw new Error('Expected pet overlay to render');
    }
    pet = renderedPet;
    vi.spyOn(pet, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 100,
      top: 100,
      right: 164,
      bottom: 164,
      left: 100,
      width: 64,
      height: 64,
      toJSON: () => ({}),
    });

    hasCapture = false;
    setPointerCapture = vi.fn(() => {
      hasCapture = true;
    });
    releasePointerCapture = vi.fn(() => {
      hasCapture = false;
    });
    Object.defineProperties(pet, {
      setPointerCapture: { configurable: true, value: setPointerCapture },
      hasPointerCapture: {
        configurable: true,
        value: vi.fn(() => hasCapture),
      },
      releasePointerCapture: {
        configurable: true,
        value: releasePointerCapture,
      },
    });
  });

  afterEach(() => {
    overlay.destroy();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('captures the pointer so fast drags keep receiving movement events', () => {
    dispatchPointerEvent(pet, 'pointerdown', {
      button: 0,
      clientX: 120,
      clientY: 120,
      pointerId: 31,
    });

    expect(setPointerCapture).toHaveBeenCalledWith(31);
    expect(pet.style.cursor).toBe('grabbing');

    dispatchPointerEvent(pet, 'pointermove', {
      clientX: 500,
      clientY: 300,
      pointerId: 31,
    });
    expect(pet.style.transform).toBe('translate3d(480px, 280px, 0)');

    dispatchPointerEvent(pet, 'pointerup', {
      button: 0,
      clientX: 500,
      clientY: 300,
      pointerId: 31,
    });
    expect(releasePointerCapture).toHaveBeenCalledWith(31);
    expect(pet.style.cursor).toBe('grab');
  });

  it('finishes and persists the drag if pointer capture is lost', () => {
    dispatchPointerEvent(pet, 'pointerdown', {
      button: 0,
      clientX: 120,
      clientY: 120,
      pointerId: 42,
    });
    dispatchPointerEvent(pet, 'pointermove', {
      clientX: 420,
      clientY: 260,
      pointerId: 42,
    });

    hasCapture = false;
    dispatchPointerEvent(pet, 'lostpointercapture', {
      clientX: 420,
      clientY: 260,
      pointerId: 42,
    });

    expect(pet.style.cursor).toBe('grab');
    expect(window.localStorage.getItem(DEFAULT_PET_STORAGE_KEY)).toBe(
      JSON.stringify({ x: 400, y: 240 }),
    );
    const stoppedPosition = pet.style.transform;

    dispatchPointerEvent(window, 'pointermove', {
      clientX: 700,
      clientY: 500,
      pointerId: 42,
    });
    expect(pet.style.transform).toBe(stoppedPosition);
  });
});
