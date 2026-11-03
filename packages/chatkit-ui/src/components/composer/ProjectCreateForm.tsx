import { useId, type FormEvent } from 'react';
import type {
  XpertProjectTypeRef,
  XpertProjectTypeSummary,
} from '@xpert-ai/xpert-sdk';
import { resolveLocalizedText } from '../../i18n/localized-text';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

const typeKey = (type: XpertProjectTypeRef) =>
  JSON.stringify([type.applicationKey, type.projectTypeKey]);

const controlClassName =
  'h-[max(1.75rem,calc(2rem*var(--chat-density-scale,1)))] px-[calc(0.75rem*var(--chat-density-scale,1))] py-[calc(0.25rem*var(--chat-density-scale,1))]';

export function ProjectCreateForm({
  types,
  projectType,
  onTypeChange,
  name,
  onNameChange,
  creating,
  error,
  canCreate,
  onCancel,
  onSubmit,
}: {
  types: XpertProjectTypeSummary[];
  projectType: XpertProjectTypeRef;
  onTypeChange: (type: XpertProjectTypeRef) => void;
  name: string;
  onNameChange: (name: string) => void;
  creating: boolean;
  error: boolean;
  canCreate: boolean;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t, i18n } = useChatkitTranslation();
  const typeId = useId();
  const selectedType = types.find(
    (type) => typeKey(type) === typeKey(projectType),
  );
  return (
    <form
      data-slot="composer-project-create-form"
      className="grid gap-[calc(0.75rem*var(--chat-density-scale,1))] p-[calc(0.25rem*var(--chat-density-scale,1))]"
      onSubmit={onSubmit}
    >
      {types.length > 0 && (
        <div className="grid min-w-0 gap-[calc(0.25rem*var(--chat-density-scale,1))] text-sm">
          <label htmlFor={typeId}>{t('composer.projects.type')}</label>
          <Select
            value={selectedType ? typeKey(selectedType) : ''}
            disabled={creating}
            onValueChange={(value) => {
              const type = types.find((item) => typeKey(item) === value);
              if (type)
                onTypeChange({
                  applicationKey: type.applicationKey,
                  projectTypeKey: type.projectTypeKey,
                });
            }}
          >
            <SelectTrigger
              id={typeId}
              aria-label={t('composer.projects.type')}
              className={`w-full min-w-0 bg-background ${controlClassName}`}
            >
              <SelectValue placeholder={t('composer.projects.type')} />
            </SelectTrigger>
            <SelectContent
              position="popper"
              align="start"
              className="max-w-[calc(100vw-1rem)]"
            >
              {types.map((type) => (
                <SelectItem
                  key={typeKey(type)}
                  value={typeKey(type)}
                  disabled={!type.available}
                >
                  <span className="truncate">
                    {resolveLocalizedText(type.applicationTitle, i18n.language)}{' '}
                    / {resolveLocalizedText(type.title, i18n.language)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Input
        autoFocus
        disabled={creating}
        value={name}
        maxLength={120}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder={t('composer.projects.namePlaceholder')}
        aria-label={t('composer.projects.namePlaceholder')}
        className={controlClassName}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t('composer.projects.createError')}
        </p>
      )}
      <div className="flex justify-end gap-[calc(0.5rem*var(--chat-density-scale,1))]">
        <Button
          type="button"
          variant="ghost"
          disabled={creating}
          onClick={onCancel}
          className={`${controlClassName} font-normal text-muted-foreground hover:bg-accent hover:text-accent-foreground`}
        >
          {t('composer.projects.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={!name.trim() || creating || !canCreate}
          className={`${controlClassName} font-normal disabled:cursor-not-allowed`}
        >
          {t(
            creating
              ? 'composer.projects.creating'
              : 'composer.projects.create',
          )}
        </Button>
      </div>
    </form>
  );
}
