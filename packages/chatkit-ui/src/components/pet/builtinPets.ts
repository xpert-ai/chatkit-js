import {
  getPetAssetUrl,
  type ChatKitPetCharacter,
} from '@xpert-ai/chatkit-types';
// Metadata is bundled at build time; the offline package is a dev dependency only.
import metadata from '../../../../chatkit-assets/pets/catalog.json';
const catalog: { id: string; label: string; spriteVersionNumber?: 1 | 2 }[] =
  metadata;

export type ChatKitIncludedPetId = string;
export type ChatKitIncludedPetOption = {
  id: ChatKitIncludedPetId;
  label: string;
  character: ChatKitPetCharacter;
  previewSrc: string;
};

export function getIncludedPetOptions(
  assetsBaseUrl?: string,
): readonly ChatKitIncludedPetOption[] {
  return catalog.map((pet) => {
    const src = getPetAssetUrl(pet.id, assetsBaseUrl);
    return {
      id: pet.id,
      label: pet.label,
      character: {
        type: 'sprite-atlas',
        src,
        spriteVersionNumber: pet.spriteVersionNumber,
      },
      previewSrc: src,
    };
  });
}

export const INCLUDED_PET_OPTIONS = getIncludedPetOptions();

export function getIncludedPetOption(
  id: string,
  assetsBaseUrl?: string,
): ChatKitIncludedPetOption | undefined {
  const resourceId = id === 'lando' ? 'lando-2' : id;
  return getIncludedPetOptions(assetsBaseUrl).find(
    (pet) => pet.id === resourceId,
  );
}

export function getIncludedPetCharacter(
  id: string,
  assetsBaseUrl?: string,
): ChatKitPetCharacter {
  return (
    getIncludedPetOption(id, assetsBaseUrl)?.character ?? {
      type: 'sprite-atlas',
      src: getPetAssetUrl('boba', assetsBaseUrl),
    }
  );
}

export function getIncludedPetIdByCharacter(
  character: ChatKitPetCharacter,
  assetsBaseUrl?: string,
): ChatKitIncludedPetId | null {
  // Recognize legacy local URLs when a host switches to a remote resource base.
  const match = [
    ...getIncludedPetOptions(assetsBaseUrl),
    ...INCLUDED_PET_OPTIONS,
  ].find(
    (pet) => Boolean(character.src) && pet.character.src === character.src,
  );
  return match?.id ?? null;
}
