import { describe, expect, it } from 'vitest';
import {
  buildPetOptionsFromLocalSettings,
  derivePetLocalSettings,
  resolvePetCommandMode,
  type PetLocalSettings,
} from './pet-local-settings';

const baseSettings: PetLocalSettings = {
  enabled: true,
  characterType: 'builtin',
  builtinId: 'boba',
  atlasUrl: '',
  scale: 0.8,
  draggable: true,
  persistPosition: true,
};

describe('pet local settings', () => {
  it('builds disabled and included pet options', () => {
    expect(
      buildPetOptionsFromLocalSettings({
        ...baseSettings,
        enabled: false,
      }),
    ).toBeNull();

    expect(buildPetOptionsFromLocalSettings(baseSettings)).toMatchObject({
      character: { type: 'sprite-atlas', src: '/pets/boba/spritesheet.webp' },
      position: { scale: 0.8, draggable: true, persist: true },
    });
  });

  it('builds included public pet presets as local spritesheets', () => {
    expect(
      buildPetOptionsFromLocalSettings({
        ...baseSettings,
        builtinId: 'boba',
      }),
    ).toMatchObject({
      character: { type: 'sprite-atlas', src: '/pets/boba/spritesheet.webp' },
      position: { scale: 0.8, draggable: true, persist: true },
    });
  });

  it('builds direct atlas pet options', () => {
    expect(
      buildPetOptionsFromLocalSettings({
        ...baseSettings,
        characterType: 'atlas',
        atlasUrl: '/pets/boba/spritesheet.webp',
      }),
    ).toMatchObject({
      character: { type: 'sprite-atlas', src: '/pets/boba/spritesheet.webp' },
    });
  });

  it('derives editable settings from configured pet options', () => {
    expect(
      derivePetLocalSettings({
        character: {
          type: 'sprite-atlas',
          src: '/pets/custom/spritesheet.webp',
        },
        position: {
          scale: 1.2,
          draggable: false,
          persist: false,
        },
      }),
    ).toMatchObject({
      enabled: true,
      characterType: 'atlas',
      atlasUrl: '/pets/custom/spritesheet.webp',
      scale: 1.2,
      draggable: false,
      persistPosition: false,
    });
  });

  it('derives included public pet presets from matching spritesheets', () => {
    expect(
      derivePetLocalSettings({
        character: {
          type: 'sprite-atlas',
          src: '/pets/bolt/spritesheet.webp',
        },
      }),
    ).toMatchObject({
      enabled: true,
      characterType: 'builtin',
      builtinId: 'bolt',
    });
  });

  it('parses /pet command modes', () => {
    expect(resolvePetCommandMode('')).toBe('toggle');
    expect(resolvePetCommandMode('on')).toBe('on');
    expect(resolvePetCommandMode('off')).toBe('off');
    expect(resolvePetCommandMode('settings')).toBe('settings');
  });
});
