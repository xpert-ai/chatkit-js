import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  customCharacterSvg,
  defaultCharacterConfig,
  parseAssistantAppearance,
} from '@xpert-ai/chatkit-types';
import { AssistantCharacter } from './AssistantCharacter';
import { normalizeChatkitAvatar } from '../../ui/chatkit-avatar';
import { INCLUDED_PET_OPTIONS } from '../../pet/builtinPets';

describe('Extensible Assistant avatars', () => {
  it('discovers bundled pets from metadata and accepts future identifiers', () => {
    expect(INCLUDED_PET_OPTIONS.length).toBeGreaterThan(0);
    expect(INCLUDED_PET_OPTIONS.some((pet) => pet.id === 'boba')).toBe(true);
    expect(
      parseAssistantAppearance({
        version: 1,
        kind: 'pet',
        id: 'future-pet_2030',
      }),
    ).toMatchObject({ id: 'future-pet_2030' });
    for (const id of ['../invalid', 'a/b', 'a%2fb', 'x'.repeat(101)])
      expect(
        parseAssistantAppearance({ version: 1, kind: 'pet', id }),
      ).toBeUndefined();
  });
  it('accepts studio properties and renders every shape without changing older configurations', () => {
    const shapes = [
      'round',
      'pebble',
      'pill',
      'drop',
      'flame',
      'triangle',
      'square',
      'bag',
      'star',
      'heart',
      'cloud',
      'clover',
    ] as const;
    const rendered = new Set<string>();
    for (const shape of shapes) {
      const appearance = {
        version: 1,
        kind: 'character',
        id: 'future-character',
        color: '#18cbb7',
        config: {
          ...defaultCharacterConfig,
          shape,
          eyes: 'toon',
          brows: 'raised',
          ink: 'light',
          tilt: -15,
          speed: 2,
          blink: false,
        },
      } as const;
      expect(parseAssistantAppearance(appearance)).toEqual(appearance);
      const svg = decodeURIComponent(
        customCharacterSvg(appearance, 'idle', true),
      );
      expect(svg).toContain('rotate(-15 100 100)');
      expect(svg).toContain('#ffffff');
      expect(svg).not.toContain('keyTimes="0;.83;.87;.91;1"');
      rendered.add(svg);
      for (const patch of [
        { tilt: 16 },
        { speed: NaN },
        { speed: 0.4 },
        { blink: 'yes' },
        { brows: 'unknown' },
        { ink: 'red' },
      ])
        expect(
          parseAssistantAppearance({
            ...appearance,
            config: { ...appearance.config, ...patch },
          }),
        ).toBeUndefined();
    }
    expect(rendered.size).toBe(shapes.length);
    expect(
      parseAssistantAppearance({
        version: 1,
        kind: 'character',
        id: 'original',
        color: '#7c6ee6',
        config: {
          shape: 'round',
          eyes: 'oval',
          mouth: 'smile',
          motion: 'float',
          eyeSize: 1,
          eyeSpacing: 1,
        },
      }),
    ).toBeDefined();
  });
  it('plays uploaded animation and uses the static preview for reduced motion', () => {
    const avatar = normalizeChatkitAvatar({
      url: '/preview.png',
      appearance: {
        version: 1,
        kind: 'pet',
        id: 'custom-123',
        asset: { type: 'animated-image', url: '/custom.gif' },
      },
    });
    const view = render(
      <AssistantCharacter avatar={avatar} name="Custom pet" state="running" />,
    );
    expect(screen.getByRole('img', { name: 'Custom pet' })).toHaveAttribute(
      'src',
      '/custom.gif',
    );
    view.rerender(
      <AssistantCharacter
        avatar={avatar}
        name="Custom pet"
        state="running"
        reducedMotion
      />,
    );
    expect(screen.getByRole('img', { name: 'Custom pet' })).toHaveAttribute(
      'src',
      '/preview.png',
    );
  });
  it('uses uploaded sprite assets with the real activity row', () => {
    const avatar = normalizeChatkitAvatar({
      appearance: {
        version: 1,
        kind: 'pet',
        id: 'custom-sprite',
        asset: { type: 'sprite-atlas', url: '/custom.webp' },
      },
    });
    const { container } = render(
      <AssistantCharacter avatar={avatar} name="Pet" state="failed" />,
    );
    const sprite = container.querySelector<HTMLElement>(
      '.chatkit-inline-pet-status__sprite',
    )!;
    expect(sprite.style.backgroundImage).toContain('/custom.webp');
    expect(sprite.style.backgroundPositionY).toBe('-1040px');
  });
  it('keeps relative-sized sprite frames and activity rows in the same coordinate system', () => {
    const avatar = normalizeChatkitAvatar({
      appearance: {
        version: 1,
        kind: 'pet',
        id: 'custom-sprite',
        asset: { type: 'sprite-atlas', url: '/custom.webp' },
      },
    });
    const view = render(
      <AssistantCharacter
        avatar={avatar}
        name="Pet"
        state="failed"
        size="4rem"
      />,
    );
    const container = screen.getByTestId('chatkit-inline-pet-status');
    const sprite = container.querySelector<HTMLElement>(
      '.chatkit-inline-pet-status__sprite',
    )!;
    expect(container.style.fontSize).toBe('4rem');
    expect(sprite.style.height).toBe('1em');
    expect(sprite.style.backgroundPositionY).toBe('-5em');
    expect(sprite.style.backgroundSize).toBe('7.384615384615385em 9em');
    expect(sprite.style.transform).not.toContain('scale');
    view.rerender(
      <AssistantCharacter
        avatar={avatar}
        name="Pet"
        state="failed"
        size="5rem"
        reducedMotion
      />,
    );
    expect(container.style.fontSize).toBe('5rem');
    expect(sprite.style.backgroundPositionY).toBe('-5em');
    expect(sprite.style.animation).toBe('none');
  });
  it('sizes custom character images using rem without invalid HTML dimensions', () => {
    const avatar = normalizeChatkitAvatar({
      appearance: {
        version: 1,
        kind: 'character',
        id: 'custom',
        color: '#7c6ee6',
        config: defaultCharacterConfig,
      },
    });
    render(
      <AssistantCharacter
        avatar={avatar}
        name="Character"
        state="idle"
        size="4rem"
      />,
    );
    const image = screen.getByRole('img', { name: 'Character' });
    expect(image).toHaveStyle({ width: '4rem', height: '4rem' });
    expect(image).not.toHaveAttribute('width');
    expect(image).not.toHaveAttribute('height');
  });
  it('renders saved character choices, reacts to states and removes animation for reduced motion', () => {
    const appearance = {
      version: 1,
      kind: 'character',
      id: 'user-character',
      color: '#7c6ee6',
      config: { ...defaultCharacterConfig, shape: 'drop', eyes: 'wink' },
    } as const;
    const avatar = normalizeChatkitAvatar({ appearance, url: '/preview.png' });
    const view = render(
      <AssistantCharacter avatar={avatar} name="Character" state="idle" />,
    );
    const idle = screen.getByRole('img').getAttribute('src');
    expect(decodeURIComponent(idle!)).toContain('animateTransform');
    view.rerender(
      <AssistantCharacter
        avatar={avatar}
        name="Character"
        state="failed"
        reducedMotion
      />,
    );
    const failed = screen.getByRole('img').getAttribute('src');
    expect(failed).not.toBe(idle);
    expect(decodeURIComponent(failed!)).not.toContain('<animate');
    expect(
      parseAssistantAppearance({
        ...appearance,
        config: { ...appearance.config, eyeSize: Infinity },
      }),
    ).toBeUndefined();
    expect(
      parseAssistantAppearance({
        version: 1,
        kind: 'pet',
        id: 'safe',
        asset: { type: 'animated-image', url: 'javascript:alert(1)' },
      }),
    ).toBeUndefined();
    expect(
      decodeURIComponent(
        customCharacterSvg({ ...appearance, color: '"><script/>' }),
      ),
    ).not.toContain('<script');
  });
});
