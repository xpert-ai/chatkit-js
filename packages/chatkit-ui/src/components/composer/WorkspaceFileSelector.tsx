import * as React from 'react';
import { ChevronDown, FileText, Search } from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  WorkspaceFileMentionPalette,
  type WorkspaceFileMentionPaletteHandle,
  type WorkspaceFileMentionPaletteProps,
} from './WorkspaceFileMentionPalette';

type Props = Omit<
  WorkspaceFileMentionPaletteProps,
  'query' | 'className' | 'showHeader'
> & {
  disabled?: boolean;
};

export function WorkspaceFileSelector({ disabled, ...props }: Props) {
  const { t } = useChatkitTranslation();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const paletteRef = React.useRef<WorkspaceFileMentionPaletteHandle>(null);

  React.useEffect(() => {
    setOpen(false);
    setQuery('');
  }, [props.client, props.assistantId, props.projectId, disabled]);

  return (
    <div
      data-slot="composer-file-selector"
      className="flex h-10 min-w-0 items-center px-1"
    >
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          setQuery('');
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="inline-flex h-5 max-w-full items-center gap-1.5 rounded-sm px-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText className="size-3.5 shrink-0" />
            <span className="truncate">
              {t('composer.fileMentions.select')}
            </span>
            <ChevronDown className="size-3.5 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={8}
          className="w-80 max-w-[calc(100vw-1rem)] max-h-(--radix-popover-content-available-height) overflow-y-auto p-1"
        >
          <div className="relative m-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={t('composer.fileMentions.search')}
              placeholder={t('composer.fileMentions.search')}
              className="h-9 border-0 bg-muted pl-9 pr-3 text-sm shadow-none focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  paletteRef.current?.moveActive(
                    event.key === 'ArrowDown' ? 1 : -1,
                  );
                } else if (event.key === 'Enter') {
                  event.preventDefault();
                  paletteRef.current?.selectActive();
                }
              }}
            />
          </div>
          <WorkspaceFileMentionPalette
            {...props}
            ref={paletteRef}
            query={query}
            showHeader={false}
            className="mb-0 border-0 shadow-none"
            onSelect={(file) => {
              props.onSelect(file);
              setOpen(false);
              setQuery('');
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
