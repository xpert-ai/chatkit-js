import { X } from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import {
  getRuntimeCapabilityColor,
  type RuntimeCapabilityOption,
} from '../../lib/runtime-capabilities';
import { cn } from '../../lib/utils';
import { RuntimeCapabilityIcon } from '../runtime-capability-icon';

export function ComposerCapabilityChip({
  option,
  onRemove,
  disabled,
}: {
  option: RuntimeCapabilityOption;
  onRemove: (option: RuntimeCapabilityOption) => void;
  disabled?: boolean;
}) {
  const { t } = useChatkitTranslation();
  const color = getRuntimeCapabilityColor(option);
  return (
    <span
      data-slot="composer-capability-chip"
      data-capability-type={option.type}
      data-capability-id={option.id}
      className={cn(
        'pointer-events-auto mx-0.5 inline-flex max-w-56 shrink-0 select-none items-center gap-1 rounded-full px-2 py-0.5 align-middle text-sm font-medium text-primary',
        option.type === 'subAgent'
          ? 'max-w-36 rounded-lg border border-border/50 bg-muted/50 text-xs font-normal text-foreground/80'
          : 'bg-primary/10',
      )}
      style={color ? { color } : undefined}
      title={
        option.description
          ? `${option.label}\n${option.description}`
          : option.label
      }
      contentEditable={false}
    >
      <RuntimeCapabilityIcon option={option} variant="chip" />
      <span className="min-w-0 truncate">{option.label}</span>
      <button
        type="button"
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onKeyDown={(event) => event.stopPropagation()}
        onClick={() => onRemove(option)}
        aria-label={t('composer.capabilities.removeSelection', {
          name: option.label,
        })}
        className="flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
