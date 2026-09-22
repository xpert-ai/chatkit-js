import * as React from 'react';
import { HoverCard } from 'radix-ui';
import type { ResourceDisplayItem } from './resource-display';
import { cn, getPanelRoundedClass } from '../../lib/utils';
import { useTheme } from '../../providers/Theme';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { IconDefinitionRenderer } from '../ui/icon-definition';
import { PanelsTopLeft } from 'lucide-react';
import { useResourceInfo } from './useResourceInfo';
import { resourceDescription } from './resource-description';

export function RuntimeResourceInfo({
  item,
  children,
}: {
  item: ResourceDisplayItem;
  children: React.ReactElement;
}) {
  const { t, i18n } = useChatkitTranslation();
  const description = resourceDescription(item.description, i18n?.language);
  const { theme } = useTheme();
  const info = useResourceInfo();
  const pointer = React.useRef(false);
  return (
    <HoverCard.Root
      open={info.activeId === info.id}
      onOpenChange={(open) => {
        if (!open) info.close(info.id);
      }}
    >
      <HoverCard.Trigger
        asChild
        onPointerEnter={(event) => {
          event.preventDefault();
          if (event.pointerType === 'touch') return;
          pointer.current = true;
          info.show(info.id, false);
        }}
        onPointerLeave={(event) => {
          event.preventDefault();
          pointer.current = false;
          info.leave(info.id);
        }}
        onFocus={(event) => {
          event.preventDefault();
          info.show(info.id, !pointer.current);
        }}
        onBlur={(event) => {
          event.preventDefault();
          info.leave(info.id);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') info.close(info.id);
        }}
      >
        {children}
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="right"
          align="start"
          sideOffset={8}
          collisionPadding={8}
          role="region"
          onPointerEnter={(event) => {
            event.preventDefault();
            info.retain(info.id);
          }}
          onPointerLeave={(event) => {
            event.preventDefault();
            info.leave(info.id);
          }}
          aria-label={`${t('composer.resources.details')}: ${item.title}`}
          className={cn(
            'z-50 w-72 max-w-[calc(100vw-1rem)] border border-border bg-popover p-3 text-sm text-popover-foreground shadow-md outline-none',
            getPanelRoundedClass(theme.radius),
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="font-medium">{item.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {t(`composer.resources.${item.status}`)}
            </span>
          </div>
          <div className="mt-2 max-h-64 space-y-2 overflow-y-auto break-words">
            <p className="text-xs text-muted-foreground">
              {t(`composer.resources.${item.kind}`)}
            </p>
            {description && (
              <p className="whitespace-pre-wrap text-muted-foreground">
                {description}
              </p>
            )}
            {item.kind === 'middleware' && (
              <div className="space-y-2 border-t border-border pt-2">
                <p className="text-xs font-medium">
                  {t('composer.resources.boundViews')}
                </p>
                {item.views?.length ? (
                  item.views.map((view) => (
                    <div key={view.key} className="flex items-start gap-2">
                      <IconDefinitionRenderer
                        icon={view.icon}
                        size={16}
                        fallback={
                          <PanelsTopLeft className="size-4 shrink-0 text-muted-foreground" />
                        }
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{view.title}</p>
                        {resourceDescription(
                          view.description,
                          i18n?.language,
                        ) && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {resourceDescription(
                              view.description,
                              i18n?.language,
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t('composer.resources.noBoundViews')}
                  </p>
                )}
              </div>
            )}
            {item.components.map((component) => (
              <p
                key={`${component.kind}:${component.key}`}
                className="text-xs text-muted-foreground"
              >
                {component.key} · {t(`composer.resources.${component.status}`)}
              </p>
            ))}
            {item.diagnostics.map((diagnostic, index) => (
              <p key={index} className="text-xs text-muted-foreground">
                {diagnostic.component}: {diagnostic.message}
              </p>
            ))}
          </div>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
