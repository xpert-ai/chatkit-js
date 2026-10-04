import type { ChatKitPetCharacter } from '@xpert-ai/chatkit-types';

const metadata = import.meta.glob<{ id: string; displayName: string; spriteVersionNumber?: 1 | 2 }>(
  '../../../public/pets/*/pet.json',
  { eager: true, import: 'default' },
);
const PUBLIC_PETS = Object.values(metadata).map((pet) => ({
  id: pet.id,
  label: pet.displayName,
  spriteVersionNumber: pet.spriteVersionNumber,
  previewSrc: `/pets/${pet.id}/spritesheet.webp`,
}));

export type ChatKitIncludedPetId = (typeof PUBLIC_PETS)[number]['id'];

export type ChatKitIncludedPetOption = {
  id: ChatKitIncludedPetId;
  label: string;
  character: ChatKitPetCharacter;
  previewSrc: string;
};

export const INCLUDED_PET_OPTIONS: readonly ChatKitIncludedPetOption[] = [
  ...PUBLIC_PETS.map((pet) => ({
    id: pet.id,
    label: pet.label,
    character: {
      type: 'sprite-atlas',
      src: pet.previewSrc,
      spriteVersionNumber: pet.spriteVersionNumber,
    } as const,
    previewSrc: pet.previewSrc,
  })),
];

export function getIncludedPetOption(
  id: string,
): ChatKitIncludedPetOption | undefined {
  return INCLUDED_PET_OPTIONS.find((pet) => pet.id === id);
}

export function getIncludedPetCharacter(id: string): ChatKitPetCharacter {
  return (
    getIncludedPetOption(id)?.character ?? {
      type: 'sprite-atlas',
      src: '/pets/boba/spritesheet.webp',
    }
  );
}

export function getIncludedPetIdByCharacter(
  character: ChatKitPetCharacter,
): ChatKitIncludedPetId | null {
  const match = INCLUDED_PET_OPTIONS.find((pet) => {
    return Boolean(character.src) && pet.character.src === character.src;
  });

  return match?.id ?? null;
}
