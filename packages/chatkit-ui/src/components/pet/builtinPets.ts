import type { ChatKitPetCharacter } from '@xpert-ai/chatkit-types';

const PUBLIC_PETS = [
  {
    id: 'batmeme',
    label: 'Batmeme',
    previewSrc: '/pets/batmeme/spritesheet.webp',
  },
  {
    id: 'boba',
    label: 'Boba',
    previewSrc: '/pets/boba/spritesheet.webp',
  },
  {
    id: 'bolt',
    label: 'Bolt',
    previewSrc: '/pets/bolt/spritesheet.webp',
  },
  {
    id: 'einstein',
    label: 'Einstein',
    previewSrc: '/pets/einstein/spritesheet.webp',
  },
  {
    id: 'lando-2',
    label: 'Lando',
    previewSrc: '/pets/lando-2/spritesheet.webp',
  },
  {
    id: 'mini-sama',
    label: 'Mini Sama',
    previewSrc: '/pets/mini-sama/spritesheet.webp',
  },
  {
    id: 'miso',
    label: 'Miso',
    previewSrc: '/pets/miso/spritesheet.webp',
  },
  {
    id: 'noir-webling',
    label: 'Noir Webling',
    previewSrc: '/pets/noir-webling/spritesheet.webp',
  },
  {
    id: 'nukey',
    label: 'Nukey',
    previewSrc: '/pets/nukey/spritesheet.webp',
  },
  {
    id: 'steve',
    label: 'Steve',
    previewSrc: '/pets/steve/spritesheet.webp',
  },
] as const;

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
  return getIncludedPetOption(id)?.character ?? {
    type: 'sprite-atlas',
    src: '/pets/boba/spritesheet.webp',
  };
}

export function getIncludedPetIdByCharacter(
  character: ChatKitPetCharacter,
): ChatKitIncludedPetId | null {
  const match = INCLUDED_PET_OPTIONS.find((pet) => {
    return Boolean(character.src) && pet.character.src === character.src;
  });

  return match?.id ?? null;
}
