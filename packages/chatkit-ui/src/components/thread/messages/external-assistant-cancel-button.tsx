import { LoaderCircle, Square } from 'lucide-react';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';

export function ExternalAssistantCancelButton({
  name,
  onCancel,
  pending,
  requested,
}: {
  name: string;
  onCancel: () => void;
  pending?: boolean;
  requested?: boolean;
}) {
  const { t } = useChatkitTranslation();
  const label = t(
    pending
      ? 'workbench.externalAssistants.cancelling'
      : requested
        ? 'workbench.externalAssistants.cancelRequested'
        : 'workbench.externalAssistants.cancel',
  );
  return (
    <button
      type="button"
      onClick={onCancel}
      disabled={pending || requested}
      aria-label={t('workbench.externalAssistants.cancelRun', { name })}
      title={label}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-50"
    >
      {pending ? (
        <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
      ) : (
        <Square className="size-3" aria-hidden="true" />
      )}
      {label}
    </button>
  );
}
