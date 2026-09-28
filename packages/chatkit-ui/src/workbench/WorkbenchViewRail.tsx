import type { XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
import { PanelRight } from 'lucide-react';
import { IconDefinitionRenderer } from '../components/ui/icon-definition';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';
import { resolveManifestText } from './manifest-text';

export function WorkbenchViewRail({
  views,
  locale,
  onSelect,
}: {
  views: XpertExtensionViewManifest[];
  locale: string;
  onSelect: (key: string) => void;
}) {
  const { t } = useChatkitTranslation();
  return (
    <nav
      aria-label={t('workbench.views')}
      data-slot="chatkit-workbench-view-rail"
      className="flex h-full min-h-0 w-12 shrink-0 flex-col items-center gap-1 overflow-y-auto overscroll-contain border-l border-border/60 bg-background px-1.5 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {views.map((view) => {
        const label = resolveManifestText(
          view.workbench?.menu?.label ?? view.title,
          view.key,
          locale,
        );
        const description = resolveManifestText(view.description, '', locale);
        return (
          <Tooltip key={view.key} delayDuration={250}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={label}
                onClick={() => onSelect(view.key)}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <IconDefinitionRenderer
                  icon={view.workbench?.menu?.icon ?? view.icon}
                  size={22}
                  fallback={<PanelRight size={22} aria-hidden="true" />}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="left"
              sideOffset={10}
              collisionPadding={12}
              hideArrow
              className="max-w-64 border bg-popover px-3 py-2.5 text-left text-popover-foreground shadow-md"
            >
              <div className="break-words text-sm font-medium">{label}</div>
              {description && (
                <div className="mt-1 line-clamp-4 break-words text-xs leading-relaxed text-muted-foreground">
                  {description}
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}
