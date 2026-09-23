import { MessageCircle, X } from 'lucide-react';
import type { ComposerThreadPart } from '../../lib/composer-parts';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

export function ComposerThreadToken({
  part,
  onRemove,
  disabled,
}: {
  part: ComposerThreadPart;
  onRemove: (key: string) => void;
  disabled?: boolean;
}) {
  const { t } = useChatkitTranslation();
  const label = part.reference.label || part.reference.threadId;
  return (
    <span
      contentEditable={false}
      data-composer-thread-key={part.key}
      className="mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-1.5 align-middle text-primary"
      title={label}
    >
      <MessageCircle className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
      <button
        type="button"
        disabled={disabled}
        aria-label={t('composer.threadMentions.remove', { title: label })}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onRemove(part.key)}
        className="rounded-sm p-0.5 hover:bg-accent"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
