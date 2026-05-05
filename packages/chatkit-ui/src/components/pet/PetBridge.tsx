import * as React from 'react';
import type {
  ChatKitOptions,
  ChatKitPetAnimationName,
} from '@xpert-ai/chatkit-types';
import { normalizePetOptions } from '@xpert-ai/chatkit-types';
import { useParentMessenger } from '../../hooks/useParentMessenger';

export type PetBridgeProps = {
  pet: ChatKitOptions['pet'] | null;
  state: ChatKitPetAnimationName;
};

export function PetBridge({ pet, state }: PetBridgeProps) {
  const parentMessenger = useParentMessenger();
  const sendEvent = parentMessenger?.sendEvent;
  const options = React.useMemo(() => normalizePetOptions(pet), [pet]);

  React.useEffect(() => {
    if (!sendEvent) {
      return;
    }

    sendEvent('pet_options_change', { pet: pet ?? null });
  }, [sendEvent, pet]);

  React.useEffect(() => {
    if (!sendEvent || !options) {
      return;
    }

    sendEvent('pet_state_change', { state });
  }, [options, sendEvent, state]);

  return null;
}
