import * as React from 'react';
import type { XpertWorkspaceFile } from '@xpert-ai/xpert-sdk';
import { ChevronRight, Search } from 'lucide-react';
import { Input } from '../../components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../components/ui/popover';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { getSurfaceThemeStyle } from '../../lib/theme-surfaces';
import { useTheme } from '../../providers/Theme';
import { WorkspaceFileTree } from './WorkspaceFileTree';
import type { useWorkspaceFileTree } from './useWorkspaceFileTree';

export function WorkspaceFileBreadcrumbs({
  path,
  isFile,
  tree,
  onSelect,
}: {
  path: string;
  isFile: boolean;
  tree: ReturnType<typeof useWorkspaceFileTree>;
  onSelect: (file: XpertWorkspaceFile) => void;
}) {
  const { t } = useChatkitTranslation();
  const { theme } = useTheme();
  const [openPath, setOpenPath] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const segments = path.split('/').filter(Boolean);
  const crumbs = [
    { label: '/', path: '' },
    ...segments.map((label, index) => ({
      label,
      path: segments.slice(0, index + 1).join('/'),
    })),
  ];

  React.useEffect(() => setOpenPath(null), [path]);
  React.useEffect(() => {
    if (openPath !== null && !tree.directories[openPath]) tree.load(openPath);
  }, [openPath, tree.directories, tree.load]);

  return (
    <nav
      aria-label={t('workbench.files.breadcrumb')}
      className="flex min-w-0 items-center gap-1 overflow-hidden text-sm"
    >
      {crumbs.map((crumb, index) => {
        const current = index === crumbs.length - 1;
        const button = (
          <button
            type="button"
            className={`min-w-0 truncate rounded-[var(--chat-item-radius,var(--radius))] px-1 py-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring ${index === 0 ? 'shrink-0' : ''} ${current ? 'font-medium' : 'text-muted-foreground'}`}
            title={crumb.path || '/'}
            aria-label={index === 0 ? t('workbench.files.root') : undefined}
            aria-current={current ? 'page' : undefined}
          >
            {crumb.label}
          </button>
        );
        return (
          <React.Fragment key={crumb.path}>
            {index > 1 && (
              <ChevronRight
                size={14}
                className="shrink-0 text-muted-foreground"
              />
            )}
            {current && isFile ? (
              button
            ) : (
              <Popover
                open={openPath === crumb.path}
                onOpenChange={(next) => {
                  setQuery('');
                  setOpenPath((current) =>
                    next ? crumb.path : current === crumb.path ? null : current,
                  );
                }}
              >
                <PopoverTrigger asChild>{button}</PopoverTrigger>
                <PopoverContent
                  align="start"
                  sideOffset={6}
                  collisionPadding={12}
                  aria-label={t('workbench.files.browseFolder', {
                    path: crumb.path || t('workbench.files.root'),
                  })}
                  style={getSurfaceThemeStyle(theme)}
                  className="flex max-h-[min(24rem,var(--radix-popover-content-available-height))] w-96 max-w-[calc(100vw-1.5rem)] flex-col gap-2 overflow-hidden rounded-[var(--chat-panel-radius,var(--radius))] p-2 shadow-lg"
                >
                  <div className="relative shrink-0">
                    <Search
                      size={15}
                      className="pointer-events-none absolute top-2.5 left-3 text-muted-foreground"
                    />
                    <Input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={t('workbench.files.search')}
                      aria-label={t('workbench.files.search')}
                      className="h-9 rounded-[var(--chat-item-radius,var(--radius))] pl-9 shadow-none"
                      onKeyDown={(event) => {
                        if (
                          event.key === 'ArrowDown' &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault();
                          event.currentTarget
                            .closest('[data-slot="popover-content"]')
                            ?.querySelector<HTMLButtonElement>(
                              '[role="treeitem"]',
                            )
                            ?.focus();
                        }
                      }}
                    />
                  </div>
                  <WorkspaceFileTree
                    rootPath={crumb.path}
                    directories={tree.directories}
                    expanded={tree.expanded}
                    query={query}
                    selectedPath={path}
                    onToggle={tree.toggle}
                    onRetry={tree.load}
                    onSelect={(file) => {
                      setOpenPath(null);
                      tree.reveal(
                        file.filePath.split('/').slice(0, -1).join('/'),
                      );
                      onSelect(file);
                    }}
                  />
                </PopoverContent>
              </Popover>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
