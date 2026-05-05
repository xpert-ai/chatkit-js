import * as React from 'react';
import { PawPrint, Settings } from 'lucide-react';

import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Slider } from '../ui/slider';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import {
  DEFAULT_PET_LOCAL_SETTINGS,
  type PetLocalCharacterType,
  type PetLocalSettings,
} from '../pet/pet-local-settings';
import {
  getIncludedPetOption,
  INCLUDED_PET_OPTIONS,
} from '../pet/builtinPets';
import { PetPreview } from '../pet/PetPreview';

export type SettingsSheetProps = {
  open: boolean;
  settings: PetLocalSettings;
  petRequired?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (settings: PetLocalSettings) => void;
};

const CHARACTER_TYPES: PetLocalCharacterType[] = [
  'builtin',
  'atlas',
];

function isPetLocalCharacterType(value: string): value is PetLocalCharacterType {
  return value === 'builtin' || value === 'atlas';
}

export function SettingsSheet({
  open,
  settings,
  petRequired = false,
  onOpenChange,
  onSave,
}: SettingsSheetProps) {
  const { t } = useChatkitTranslation();
  const [draft, setDraft] = React.useState(settings);

  React.useEffect(() => {
    if (open) {
      setDraft(petRequired ? { ...settings, enabled: true } : settings);
    }
  }, [open, petRequired, settings]);

  const updateDraft = React.useCallback(
    (patch: Partial<PetLocalSettings>) => {
      setDraft((previous) => ({ ...previous, ...patch }));
    },
    [],
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave(petRequired ? { ...draft, enabled: true } : draft);
    onOpenChange(false);
  };

  const selectedBuiltinPet =
    getIncludedPetOption(draft.builtinId) ?? INCLUDED_PET_OPTIONS[0]!;
  const selectedBuiltinPetLabel = t(
    `pet.settings.builtins.${selectedBuiltinPet.id}`,
    {
      defaultValue: selectedBuiltinPet.label,
    },
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(92vw,26rem)] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Settings size={16} />
            </span>
            <SheetTitle>{t('settings.title')}</SheetTitle>
          </div>
        </SheetHeader>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <section className="space-y-5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <PawPrint size={15} />
              </span>
              <h3 className="text-sm font-semibold">{t('pet.settings.title')}</h3>
            </div>

            <label className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {t('pet.settings.enabled')}
                </span>
                {petRequired && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {t('pet.settings.requiredHint')}
                  </span>
                )}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={draft.enabled}
                disabled={petRequired}
                onClick={() => updateDraft({ enabled: !draft.enabled })}
                className={[
                  'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors',
                  draft.enabled ? 'bg-primary' : 'bg-muted-foreground/20',
                  petRequired ? 'cursor-not-allowed opacity-70' : '',
                ].join(' ')}
              >
                <span
                  className={[
                    'inline-block h-5 w-5 rounded-full bg-background shadow-sm transition-transform',
                    draft.enabled ? 'translate-x-[18px]' : 'translate-x-0.5',
                  ].join(' ')}
                />
              </button>
            </label>
          </section>

          <div className="space-y-2">
            <span id="chatkit-pet-type-label" className="text-sm font-medium">
              {t('pet.settings.characterType')}
            </span>
            <ToggleGroup
              id="chatkit-pet-type"
              type="single"
              value={draft.characterType}
              onValueChange={(value) => {
                if (isPetLocalCharacterType(value)) {
                  updateDraft({ characterType: value });
                }
              }}
              aria-labelledby="chatkit-pet-type-label"
              variant="outline"
              spacing={2}
              className="!w-full"
            >
              {CHARACTER_TYPES.map((type) => (
                <ToggleGroupItem
                  key={type}
                  value={type}
                  className="flex-1 rounded-md data-[state=on]:border-primary/50 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
                >
                  {t(`pet.settings.characterTypes.${type}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {draft.characterType === 'builtin' && (
            <div className="space-y-2">
              <label
                htmlFor="chatkit-pet-builtin"
                className="text-sm font-medium"
              >
                {t('pet.settings.builtin')}
              </label>
              <Select
                value={selectedBuiltinPet.id}
                onValueChange={(value) => {
                  const pet = getIncludedPetOption(value);
                  if (pet) {
                    updateDraft({ builtinId: pet.id });
                  }
                }}
              >
                <SelectTrigger
                  id="chatkit-pet-builtin"
                  className="min-h-12 w-full px-3 py-2"
                >
                  <SelectValue placeholder={selectedBuiltinPetLabel} />
                </SelectTrigger>
                <SelectContent className="w-[var(--radix-select-trigger-width)]">
                  <SelectGroup>
                    {INCLUDED_PET_OPTIONS.map((pet) => {
                      const label = t(`pet.settings.builtins.${pet.id}`, {
                        defaultValue: pet.label,
                      });

                      return (
                        <SelectItem
                          key={pet.id}
                          value={pet.id}
                          className="min-h-10 py-1.5 pl-2 pr-8"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <PetPreview src={pet.previewSrc} label={label} />
                            <span className="min-w-0 truncate">{label}</span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}

          {draft.characterType === 'atlas' && (
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="chatkit-pet-atlas"
              >
                {t('pet.settings.atlasUrl')}
              </label>
              <Input
                id="chatkit-pet-atlas"
                value={draft.atlasUrl}
                onChange={(event) =>
                  updateDraft({ atlasUrl: event.currentTarget.value })
                }
                placeholder="/pets/boba/spritesheet.webp"
              />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium" htmlFor="chatkit-pet-scale">
                {t('pet.settings.scale')}
              </label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {draft.scale.toFixed(2)}x
              </span>
            </div>
            <Slider
              id="chatkit-pet-scale"
              min={0.1}
              max={2}
              step={0.05}
              value={[draft.scale]}
              onValueChange={(value) =>
                updateDraft({
                  scale: value[0] ?? DEFAULT_PET_LOCAL_SETTINGS.scale,
                })
              }
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.draggable}
              onChange={(event) =>
                updateDraft({ draggable: event.currentTarget.checked })
              }
              className="h-4 w-4 rounded border-input accent-primary"
            />
            {t('pet.settings.draggable')}
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.persistPosition}
              onChange={(event) =>
                updateDraft({ persistPosition: event.currentTarget.checked })
              }
              className="h-4 w-4 rounded border-input accent-primary"
            />
            {t('pet.settings.persistPosition')}
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('pet.settings.cancel')}
            </Button>
            <Button type="submit">{t('pet.settings.save')}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
