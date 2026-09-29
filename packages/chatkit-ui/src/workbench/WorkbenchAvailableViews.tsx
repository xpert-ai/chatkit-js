import type { XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
import { Plus } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import { resolveManifestText } from './manifest-text';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';
import * as React from 'react';

export function WorkbenchAvailableViews({
  views,
  locale,
  onSelect,
}: {
  views: XpertExtensionViewManifest[];
  locale: string;
  onSelect: (key: string) => void;
}) {
  const { t } = useChatkitTranslation();
  const [open, setOpen] = React.useState(false);
  if (!views.length) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={t('workbench.addView')}
          aria-label={t('workbench.addView')}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <Plus size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-1" align="end">
        {views.map((view) => (
          <button
            key={view.key}
            type="button"
            className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => {
              onSelect(view.key);
              setOpen(false);
            }}
          >
            {resolveManifestText(
              view.workbench?.menu?.label ?? view.title,
              view.key,
              locale,
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
