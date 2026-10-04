import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  parseAssistantAppearance,
  petLookFrame,
  resolvePetCharacter,
} from '@xpert-ai/chatkit-types';
import { AssistantCharacter } from '../chat/header/AssistantCharacter';
import { normalizeChatkitAvatar } from '../ui/chatkit-avatar';

describe('v2 pet sprites', () => {
  it('preserves explicit sprite versions independently of appearance version and legacy IDs', () => {
    for (const spriteVersionNumber of [undefined, 1, 2] as const) {
      const appearance = {
        version: 1,
        kind: 'pet',
        id: 'user-pet_2040',
        spriteVersionNumber,
      };
      expect(parseAssistantAppearance(appearance)).toEqual(appearance);
      const pet = resolvePetCharacter({
        type: 'sprite-atlas',
        src: '/pet.webp',
        spriteVersionNumber,
      });
      expect(pet?.atlas.rows).toBe(spriteVersionNumber === 2 ? 11 : 9);
      expect(pet?.atlas.animations.review.row).toBe(8);
    }
    for (const version of [0, 3, '2', null])
      expect(
        parseAssistantAppearance({
          version: 1,
          kind: 'pet',
          id: 'pet',
          spriteVersionNumber: version,
        }),
      ).toBeUndefined();
  });

  it('maps the 16 directional poses clockwise from up and restores idle at the centre', () => {
    for (let index = 0; index < 16; index++) {
      const angle = (index * Math.PI) / 8;
      expect(
        petLookFrame(Math.sin(angle) * 100, -Math.cos(angle) * 100),
      ).toEqual({ row: 9 + Math.floor(index / 8), column: index % 8 });
    }
    expect(petLookFrame(0, 0)).toBeNull();
  });

  it('renders v2 without squashing, follows the pointer only when idle, and respects reduced motion', () => {
    const avatar = normalizeChatkitAvatar({
      appearance: {
        version: 1,
        kind: 'pet',
        id: 'quill',
        spriteVersionNumber: 2,
        asset: { type: 'sprite-atlas', url: '/quill.webp' },
      },
    });
    const view = render(
      <AssistantCharacter avatar={avatar} name="Quill" state="idle" />,
    );
    const sprite = () =>
      view.container.querySelector<HTMLElement>(
        '.chatkit-inline-pet-status__sprite',
      )!;
    expect(sprite().style.backgroundSize).toBe('1536px 2288px');
    // jsdom has no native PointerEvent; MouseEvent supplies the pointer coordinates.
    fireEvent(
      window,
      new MouseEvent('pointermove', { clientX: 100, clientY: 0 }),
    );
    expect(sprite().style.backgroundPositionY).toBe('-1872px');
    expect(sprite().style.backgroundPositionX).toBe('-768px');
    expect(sprite().style.animation).toBe('none');
    fireEvent.blur(window);
    expect(sprite().style.backgroundPositionY).toMatch(/^-?0px$/);
    view.rerender(
      <AssistantCharacter avatar={avatar} name="Quill" state="failed" />,
    );
    fireEvent(
      window,
      new MouseEvent('pointermove', { clientX: 0, clientY: 100 }),
    );
    expect(sprite().style.backgroundPositionY).toBe('-1040px');
    view.rerender(
      <AssistantCharacter
        avatar={avatar}
        name="Quill"
        state="idle"
        reducedMotion
      />,
    );
    fireEvent(
      window,
      new MouseEvent('pointermove', { clientX: 100, clientY: 0 }),
    );
    expect(sprite().style.backgroundPositionY).toMatch(/^-?0px$/);
    expect(sprite().style.animation).toBe('none');
  });
});
