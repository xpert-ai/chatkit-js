import * as React from 'react';
import type { ChatKitPetCharacter } from '@xpert-ai/chatkit-types';
import {
  DEFAULT_PET_SIZE,
  normalizePetOptions,
  resolvePetCharacter,
  type NormalizedPetOptions,
  type ResolvedPetCharacter,
} from '@xpert-ai/chatkit-types';

export {
  DEFAULT_PET_SIZE,
  normalizePetOptions,
  resolvePetCharacter,
  type NormalizedPetOptions,
  type ResolvedPetCharacter,
};

export function useResolvedPetCharacter(
  character: ChatKitPetCharacter,
): ResolvedPetCharacter | null {
  return React.useMemo(() => {
    return resolvePetCharacter(character);
  }, [character]);
}
