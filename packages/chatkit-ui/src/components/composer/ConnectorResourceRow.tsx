import { DropdownMenu as Menu } from 'radix-ui';
import { Cable, Check, Plus } from 'lucide-react';
import type { ConnectorRuntimeOption } from '@xpert-ai/xpert-sdk';
import { IconDefinitionRenderer } from '../ui/icon-definition';
import { useTheme } from '../../providers/Theme';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { cn, getMenuItemRoundedClass } from '../../lib/utils';
import { resourceDescription } from './resource-description';

export function connectorUsable(option: ConnectorRuntimeOption) {
  return option.status === 'active' && option.authorizationMode === 'shared';
}
export function ConnectorResourceRow({
  option,
  selected,
  busy,
  menu = true,
  onToggle,
}: {
  option: ConnectorRuntimeOption;
  selected: boolean;
  busy: boolean;
  menu?: boolean;
  onToggle: (option: ConnectorRuntimeOption) => void;
}) {
  const { t, i18n } = useChatkitTranslation();
  const { theme } = useTheme();
  const usable = connectorUsable(option);
  const title =
    resourceDescription(option.label, i18n?.language) || option.provider;
  const className = cn(
    'flex min-h-8 w-full cursor-pointer items-center gap-2 px-2 py-1 text-left text-sm outline-none hover:bg-accent focus:bg-accent data-[highlighted]:bg-accent disabled:opacity-50 data-[disabled]:opacity-50',
    getMenuItemRoundedClass(theme.radius),
  );
  const content = (
    <>
      <IconDefinitionRenderer
        icon={option.icon}
        size={16}
        fallback={<Cable className="size-4 shrink-0 text-muted-foreground" />}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{title}</span>
        <span className="block text-xs text-muted-foreground">
          {t(
            usable
              ? 'composer.connections.serviceCapability'
              : 'composer.resources.requires_auth',
          )}
        </span>
      </span>
      {selected ? (
        <Check className="size-4 shrink-0" />
      ) : (
        <Plus className="size-5 shrink-0 text-muted-foreground" />
      )}
    </>
  );
  return menu ? (
    <Menu.CheckboxItem
      checked={selected}
      textValue={title}
      disabled={busy}
      className={className}
      onSelect={(event) => {
        event.preventDefault();
        onToggle(option);
      }}
    >
      {content}
    </Menu.CheckboxItem>
  ) : (
    <button
      type="button"
      aria-pressed={selected}
      disabled={busy}
      className={className}
      onClick={() => onToggle(option)}
    >
      {content}
    </button>
  );
}
