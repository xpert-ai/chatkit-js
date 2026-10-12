import { useState, type ComponentProps, type Ref } from 'react';
import { ChevronDown, Folder } from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

/** A locked Project keeps the same menu entry available for authorized management. */
export function ProjectManagementMenu({
  label,
  management,
  disabled,
  triggerRef,
  onCloseAutoFocus,
}: {
  label?: string;
  management: { label: string; onSelect: () => void; lockedReason?: string };
  disabled: boolean;
  triggerRef?: Ref<HTMLButtonElement>;
  onCloseAutoFocus?: ComponentProps<typeof PopoverContent>['onCloseAutoFocus'];
}) {
  const { t } = useChatkitTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div
      data-slot="composer-project-rail"
      className="flex h-10 min-w-0 items-center px-1"
    >
      <Popover open={open && !disabled} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            ref={triggerRef}
            disabled={disabled}
            aria-label={t('composer.projects.select')}
            className="inline-flex h-5 max-w-full items-center gap-1.5 rounded-chat-item px-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Folder className="size-3.5 shrink-0" />
            <span className="truncate">
              {label || t('composer.projects.select')}
            </span>
            <ChevronDown className="size-3.5 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={8}
          onCloseAutoFocus={onCloseAutoFocus}
          className="grid w-80 max-w-[calc(100vw-1rem)] gap-[calc(.5rem*var(--chat-density-scale,1))] p-[calc(.75rem*var(--chat-density-scale,1))]"
        >
          {label && <p className="truncate text-sm font-medium">{label}</p>}
          {management.lockedReason && (
            <p className="text-xs text-muted-foreground">
              {management.lockedReason}
            </p>
          )}
          <button
            type="button"
            className="rounded-chat-item px-2 py-[calc(.5rem*var(--chat-density-scale,1))] text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => {
              setOpen(false);
              management.onSelect();
            }}
          >
            {management.label}
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
