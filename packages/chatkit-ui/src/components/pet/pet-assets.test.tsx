import React from 'react';
import { render, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getPetAssetUrl,
  getPetAssetsBaseUrl,
  normalizePetOptions,
} from '@xpert-ai/chatkit-types';
import { getIncludedPetCharacter, getIncludedPetOptions } from './builtinPets';
import {
  buildPetOptionsFromLocalSettings,
  DEFAULT_PET_LOCAL_SETTINGS,
  derivePetLocalSettings,
} from './pet-local-settings';
import { useChatPetSettings } from '../chat/pet/useChatPetSettings';
import { PetAssetsContext } from './PetAssets';
import { AssistantCharacter } from '../chat/header/AssistantCharacter';

const api = {
  apiUrl: 'https://api.example.test',
  xpertId: 'assistant',
  getClientSecret: async () => 'test-secret',
};
const remote = 'https://cdn.example.test/chatkit-assets/0.1.0/pets';
beforeEach(() => localStorage.clear());

describe('independent pet asset locations', () => {
  it('keeps legacy defaults and supports root, subpath and versioned CDN bases', () => {
    expect(getIncludedPetCharacter('lando', remote).src).toBe(
      `${remote}/lando-2/spritesheet.webp`,
    );
    expect(getPetAssetUrl('boba')).toBe('/pets/boba/spritesheet.webp');
    expect(getPetAssetUrl('boba', '/')).toBe('/boba/spritesheet.webp');
    expect(getPetAssetUrl('boba', '/chatkit/pets/')).toBe(
      '/chatkit/pets/boba/spritesheet.webp',
    );
    expect(
      normalizePetOptions({ enabled: true, assetsBaseUrl: remote })?.character
        .src,
    ).toBe(`${remote}/boba/spritesheet.webp`);
    expect(normalizePetOptions({ assetsBaseUrl: remote })?.character.src).toBe(
      `${remote}/boba/spritesheet.webp`,
    );
    expect(normalizePetOptions(false)).toBeNull();
    expect(
      getIncludedPetOptions(remote).every((pet) =>
        pet.previewSrc.startsWith(remote),
      ),
    ).toBe(true);
    expect(getIncludedPetCharacter('missing', remote).src).toBe(
      `${remote}/boba/spritesheet.webp`,
    );
  });

  it('keeps boolean defaults and reads resources independently of enabled', () => {
    expect(normalizePetOptions(true)?.character.src).toBe(
      '/pets/boba/spritesheet.webp',
    );
    const pet = { enabled: false, assetsBaseUrl: remote };
    expect(normalizePetOptions(pet)).toBeNull();
    expect(getPetAssetsBaseUrl(pet)).toBe(remote);
    expect(getPetAssetsBaseUrl(true)).toBeUndefined();
    expect(getPetAssetsBaseUrl(false)).toBeUndefined();
    const { result } = renderHook(() =>
      useChatPetSettings({ options: { api, pet } }),
    );
    expect(result.current.effectivePet).toBeNull();
    const required = renderHook(() =>
      useChatPetSettings({
        options: { api, pet, displayMode: 'pet' },
      }),
    );
    expect(required.result.current.effectivePet).toMatchObject({
      character: { src: `${remote}/boba/spritesheet.webp` },
    });
  });

  it('preserves custom URLs, atlas definitions and v2 sprite versions', () => {
    const character = {
      type: 'sprite-atlas' as const,
      src: '/custom.webp',
      spriteVersionNumber: 2 as const,
      atlas: { rows: 11 },
    };
    expect(
      normalizePetOptions({ character, assetsBaseUrl: remote })?.character,
    ).toEqual(character);
    expect(
      buildPetOptionsFromLocalSettings(
        {
          ...DEFAULT_PET_LOCAL_SETTINGS,
          enabled: true,
          characterType: 'atlas',
          atlasUrl: '/pets/custom.webp',
        },
        remote,
      ),
    ).toMatchObject({ character: { src: '/pets/custom.webp' } });
  });

  it('recognizes saved builtin choices and resolves them against the current base', () => {
    const settings = derivePetLocalSettings(
      { character: getIncludedPetCharacter('bolt') },
      remote,
    );
    expect(settings.builtinId).toBe('bolt');
    expect(buildPetOptionsFromLocalSettings(settings, remote)).toMatchObject({
      character: { src: `${remote}/bolt/spritesheet.webp` },
    });
    expect(
      derivePetLocalSettings(
        { character: getIncludedPetCharacter('bolt', remote) },
        remote,
      ).builtinId,
    ).toBe('bolt');
  });

  it('updates a mounted chat and keeps separate chat instances independent', () => {
    const first = renderHook(
      ({ base }) =>
        useChatPetSettings({ options: { api, pet: { assetsBaseUrl: base } } }),
      { initialProps: { base: remote } },
    );
    const second = renderHook(() =>
      useChatPetSettings({
        options: { api, pet: { assetsBaseUrl: '/offline/pets' } },
      }),
    );
    expect(first.result.current.effectivePet).toMatchObject({
      character: { src: `${remote}/boba/spritesheet.webp` },
    });
    first.rerender({ base: '/new/pets' });
    expect(first.result.current.effectivePet).toMatchObject({
      character: { src: '/new/pets/boba/spritesheet.webp' },
    });
    expect(second.result.current.effectivePet).toMatchObject({
      character: { src: '/offline/pets/boba/spritesheet.webp' },
    });
  });

  it('uses the same location for assistant appearance sprites', () => {
    const { container, rerender } = render(
      <PetAssetsContext.Provider
        value={getPetAssetsBaseUrl({ enabled: false, assetsBaseUrl: remote })}
      >
        <AssistantCharacter
          avatar={{ appearance: { version: 1, kind: 'pet', id: 'boba' } }}
          name="Boba"
          state="idle"
        />
      </PetAssetsContext.Provider>,
    );
    expect(
      container.querySelector('.chatkit-inline-pet-status__sprite'),
    ).toHaveStyle({
      backgroundImage: `url("${remote}/boba/spritesheet.webp")`,
    });
    rerender(
      <PetAssetsContext.Provider value="/offline/pets">
        <AssistantCharacter
          avatar={{ appearance: { version: 1, kind: 'pet', id: 'boba' } }}
          name="Boba"
          state="idle"
        />
      </PetAssetsContext.Provider>,
    );
    expect(
      container.querySelector('.chatkit-inline-pet-status__sprite'),
    ).toHaveStyle({
      backgroundImage: 'url("/offline/pets/boba/spritesheet.webp")',
    });
  });
});
