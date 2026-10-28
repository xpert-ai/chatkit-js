import type { FormEvent } from 'react';
import type {
  XpertProjectTypeRef,
  XpertProjectTypeSummary,
} from '@xpert-ai/xpert-sdk';
import { resolveLocalizedText } from '../../i18n/localized-text';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Input } from '../ui/input';

const typeKey = (type: XpertProjectTypeRef) =>
  JSON.stringify([type.applicationKey, type.projectTypeKey]);

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
  return (
    <form
      data-slot="composer-project-create-form"
      className="space-y-3 p-1"
      onSubmit={onSubmit}
    >
      {types.length > 0 && (
        <label className="grid gap-1 text-sm">
          {t('composer.projects.type')}
          <select
            aria-label={t('composer.projects.type')}
            className="min-w-0 rounded-chat-item border border-border bg-popover px-2 py-1 text-sm"
            value={typeKey(projectType)}
            disabled={creating}
            onChange={(event) => {
              const type = types.find(
                (item) => typeKey(item) === event.target.value,
              );
              if (type)
                onTypeChange({
                  applicationKey: type.applicationKey,
                  projectTypeKey: type.projectTypeKey,
                });
            }}
          >
            {!types.some((type) => typeKey(type) === typeKey(projectType)) && (
              <option value={typeKey(projectType)} disabled>
                {t('composer.projects.type')}
              </option>
            )}
            {types.map((type) => (
              <option
                key={typeKey(type)}
                value={typeKey(type)}
                disabled={!type.available}
              >
                {resolveLocalizedText(type.applicationTitle, i18n.language)} /{' '}
                {resolveLocalizedText(type.title, i18n.language)}
              </option>
            ))}
          </select>
        </label>
      )}
      <Input
        autoFocus
        disabled={creating}
        value={name}
        maxLength={120}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder={t('composer.projects.namePlaceholder')}
        aria-label={t('composer.projects.namePlaceholder')}
        className="rounded-chat-item"
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t('composer.projects.createError')}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={creating}
          onClick={onCancel}
          className="rounded-chat-item px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          {t('composer.projects.cancel')}
        </button>
        <button
          type="submit"
          disabled={!name.trim() || creating || !canCreate}
          className="rounded-chat-item bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t(
            creating
              ? 'composer.projects.creating'
              : 'composer.projects.create',
          )}
        </button>
      </div>
    </form>
  );
}
