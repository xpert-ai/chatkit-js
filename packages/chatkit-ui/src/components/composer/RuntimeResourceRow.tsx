import { RuntimeResourceInfo } from './RuntimeResourceInfo';
import { DropdownMenu as Menu } from 'radix-ui';
import { Bot, Check, Info, Layers, Plus, Puzzle } from 'lucide-react';
import type { ResourceDisplayItem } from './resource-display';
import { cn, getMenuItemRoundedClass } from '../../lib/utils';
import { useTheme } from '../../providers/Theme';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { ChatkitAvatar } from '../ui/chatkit-avatar';
import { IconDefinitionRenderer } from '../ui/icon-definition';

export function ResourceIcon({
  item,
  small = false,
}: {
  item?: ResourceDisplayItem;
  small?: boolean;
}) {
  const { theme } = useTheme();
  const Icon =
    item?.kind === 'external_xpert'
      ? Bot
      : item?.kind === 'middleware'
        ? Layers
        : Puzzle;
  const fallback = <Icon className="size-4 shrink-0 text-muted-foreground" />;
  const icon = item?.avatar ? (
    <ChatkitAvatar
      avatar={item.avatar}
      label={item.title}
      fallback={fallback}
      className="size-4 rounded-none"
      fallbackClassName="rounded-none bg-transparent text-sm"
      imageClassName="object-contain"
      data-slot="runtime-resource-avatar"
    />
  ) : (
    <IconDefinitionRenderer
      icon={
        item?.iconDefinition ??
        (item?.icon ? { type: 'image', value: item.icon } : undefined)
      }
      size={16}
      fallback={fallback}
      dataSlot="runtime-resource-icon"
    />
  );
  if (!small) return icon;
  return (
    <span
      className={cn(
        'flex size-5 shrink-0 items-center justify-center bg-background ring-1 ring-border',
        getMenuItemRoundedClass(theme.radius),
      )}
    >
      {icon}
    </span>
  );
}

export function RuntimeResourceRow({
  item,
  selected,
  busy,
  onToggle,
  onDetails,
  menu = true,
}: {
  item: ResourceDisplayItem;
  selected: boolean;
  busy: boolean;
  menu?: boolean;
  onToggle: (item: ResourceDisplayItem) => void;
  onDetails: (item: ResourceDisplayItem) => void;
}) {
  const { t } = useChatkitTranslation();
  const { theme } = useTheme();
  const rounded = getMenuItemRoundedClass(theme.radius);
  const blocked =
    !selected &&
    ['unavailable', 'configuration_required'].includes(item.status);
  const rowClass = cn(
    'flex min-h-8 min-w-0 flex-1 cursor-pointer items-center gap-2 px-2 py-1 text-left text-sm outline-none data-[disabled]:cursor-default data-[disabled]:opacity-50 disabled:opacity-50',
    !menu &&
      'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
    rounded,
  );
  const detailClass = cn(
    'mr-1 flex size-6 shrink-0 cursor-pointer items-center justify-center text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
    !menu &&
      'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
    rounded,
  );
  const label = (
    <>
      <ResourceIcon item={item} />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{item.title}</span>
        {item.status !== 'ready' && (
          <span className="block text-xs text-muted-foreground">
            {t(`composer.resources.${item.status}`)}
          </span>
        )}
      </span>
      {selected ? (
        <Check className="size-4 shrink-0 text-muted-foreground" />
      ) : item.kind === 'agent_plugin' ? (
        <Plus
          className="size-5 shrink-0 text-muted-foreground"
          strokeWidth={1.6}
        />
      ) : null}
    </>
  );
  const detailLabel = `${t('composer.resources.details')}: ${item.title}`;
  return (
    <div
      className={cn(
        'group flex items-center hover:bg-accent hover:text-accent-foreground focus-within:bg-accent focus-within:text-accent-foreground',
        rounded,
      )}
    >
      {menu ? (
        <>
          <Menu.CheckboxItem
            checked={selected}
            disabled={busy || blocked}
            textValue={item.title}
            onSelect={(event) => {
              event.preventDefault();
              onToggle(item);
            }}
            className={rowClass}
          >
            {label}
          </Menu.CheckboxItem>
          {item.kind !== 'agent_plugin' && (
            <RuntimeResourceInfo item={item}>
              <Menu.Item
                aria-label={detailLabel}
                onSelect={() => onDetails(item)}
                className={detailClass}
              >
                <Info className="size-3.5" />
              </Menu.Item>
            </RuntimeResourceInfo>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            aria-pressed={selected}
            disabled={busy || blocked}
            onClick={() => onToggle(item)}
            className={rowClass}
          >
            {label}
          </button>
          {item.kind !== 'agent_plugin' && (
            <RuntimeResourceInfo item={item}>
              <button
                type="button"
                aria-label={detailLabel}
                onClick={() => onDetails(item)}
                className={detailClass}
              >
                <Info className="size-3.5" />
              </button>
            </RuntimeResourceInfo>
          )}
        </>
      )}
    </div>
  );
}
