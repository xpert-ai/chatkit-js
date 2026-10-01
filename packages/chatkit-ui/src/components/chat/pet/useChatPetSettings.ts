import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import * as React from 'react';
import {
  buildPetOptionsFromLocalSettings,
  derivePetLocalSettings,
  isPetEnabled,
  readPetLocalSettings,
  writePetLocalSettings,
  type PetCommandMode,
  type PetLocalSettings,
} from '../../pet/pet-local-settings';

type ChatPetSettingsOptions = {
  options: ChatKitOptions | null | undefined;
};

export function useChatPetSettings({ options }: ChatPetSettingsOptions) {
  const [petSettingsOpen, setPetSettingsOpen] = React.useState(false);
  const [petLocalSettings, setPetLocalSettings] =
    React.useState<PetLocalSettings | null>(() => readPetLocalSettings());

  const petRequired = options?.displayMode === 'pet';
  const petDisabled = options?.pet === false && !petRequired;
  const basePetSettings = React.useMemo(
    () => derivePetLocalSettings(options?.pet),
    [options?.pet],
  );

  const displayedPetSettings = React.useMemo(
    () => ({
      ...(petLocalSettings ?? basePetSettings),
      ...(petRequired ? { enabled: true } : {}),
    }),
    [basePetSettings, petLocalSettings, petRequired],
  );

  const effectivePet = React.useMemo(() => {
    if (petDisabled) return false;
    if (petRequired || petLocalSettings) {
      return buildPetOptionsFromLocalSettings(displayedPetSettings);
    }

    return options?.pet ?? null;
  }, [
    displayedPetSettings,
    options?.pet,
    petDisabled,
    petLocalSettings,
    petRequired,
  ]);

  const savePetLocalSettings = React.useCallback(
    (settings: PetLocalSettings) => {
      if (petDisabled) return;
      const nextSettings = petRequired
        ? { ...settings, enabled: true }
        : settings;
      setPetLocalSettings(nextSettings);
      writePetLocalSettings(nextSettings);
    },
    [petDisabled, petRequired],
  );

  const handlePetCommand = React.useCallback(
    (mode: PetCommandMode) => {
      if (petDisabled) return;
      if (mode === 'settings') {
        setPetSettingsOpen(true);
        return;
      }

      if (petRequired) {
        savePetLocalSettings({
          ...displayedPetSettings,
          enabled: true,
        });
        return;
      }

      const enabled =
        mode === 'toggle' ? !isPetEnabled(effectivePet) : mode === 'on';
      savePetLocalSettings({
        ...displayedPetSettings,
        enabled,
      });
    },
    [
      displayedPetSettings,
      effectivePet,
      petDisabled,
      petRequired,
      savePetLocalSettings,
    ],
  );

  const handleSetPetEnabled = React.useCallback(
    (enabled: boolean) => {
      if (petRequired) return;
      savePetLocalSettings({ ...displayedPetSettings, enabled });
    },
    [displayedPetSettings, petRequired, savePetLocalSettings],
  );
  return {
    handleSetPetEnabled,
    effectivePet,
    handlePetCommand,
    petDisabled,
    petSettingsOpen,
    setPetSettingsOpen,
    displayedPetSettings,
    petRequired,
    savePetLocalSettings,
  };
}
