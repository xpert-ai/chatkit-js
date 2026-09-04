import * as React from 'react';
import {
  Check,
  ChevronDown,
  Folder,
  FolderLock,
  FolderX,
  Plus,
  Search,
} from 'lucide-react';
import type { Client, XpertProject } from '@xpert-ai/xpert-sdk';

import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import {
  cn,
  getMenuItemRoundedClass,
  getPanelRoundedClass,
} from '../../lib/utils';
import { useTheme } from '../../providers/Theme';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

export type ProjectSelectorProps = {
  client: Client | null;
  xpertId?: string;
  activeProjectId?: string | null;
  disabled?: boolean;
  locked?: boolean;
  label?: string;
  onAvailabilityChange?: (available: boolean) => void;
  onProjectChange?: (projectId: string | null) => void;
  onProjectCreate?: (name: string) => void;
};

const PROJECT_PAGE_SIZE = 100;

async function listAllAvailableProjects(
  projectsClient: Client['projects'],
  xpertId: string,
  signal: AbortSignal,
): Promise<XpertProject[]> {
  const projects: XpertProject[] = [];
  let skip = 0;

  while (!signal.aborted) {
    const page = await projectsClient.list({
      xpertId,
      status: 'active',
      skip,
      take: PROJECT_PAGE_SIZE,
      signal,
    });
    projects.push(...page.items);
    skip += page.items.length;

    if (
      page.items.length === 0 ||
      page.items.length < PROJECT_PAGE_SIZE ||
      skip >= page.total
    ) {
      break;
    }
  }

  return projects;
}

export function ProjectSelector({
  client,
  xpertId,
  activeProjectId,
  disabled = false,
  locked = false,
  label,
  onAvailabilityChange,
  onProjectChange,
  onProjectCreate,
}: ProjectSelectorProps) {
  const { t } = useChatkitTranslation();
  const { theme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [createMode, setCreateMode] = React.useState(false);
  const [newProjectName, setNewProjectName] = React.useState('');
  const [projects, setProjects] = React.useState<XpertProject[]>([]);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [loadedFor, setLoadedFor] = React.useState<{
    client: Client;
    xpertId: string;
  } | null>(null);
  const panelRoundedClass = getPanelRoundedClass(theme.radius);
  const menuItemRoundedClass = getMenuItemRoundedClass(theme.radius);

  const lockedProjectLabel = label?.trim();

  React.useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  React.useEffect(() => {
    if (locked) {
      setProjects([]);
      setLoadFailed(false);
      setLoadedFor(null);
      return;
    }
    if (!client || !xpertId) {
      setProjects([]);
      setLoadFailed(false);
      setLoadedFor(null);
      return;
    }

    const projectsClient = client.projects;
    if (!projectsClient || typeof projectsClient.list !== 'function') {
      console.warn(
        '[Chat] Project discovery is unavailable in the installed SDK.',
      );
      setProjects([]);
      setLoadFailed(true);
      setLoadedFor({ client, xpertId });
      return;
    }

    const controller = new AbortController();
    setProjects([]);
    setLoadFailed(false);
    setLoadedFor(null);

    listAllAvailableProjects(projectsClient, xpertId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setProjects(result);
        setLoadedFor({ client, xpertId });
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        console.warn('[Chat] Failed to load projects:', loadError);
        setProjects([]);
        setLoadFailed(true);
        setLoadedFor({ client, xpertId });
      });

    return () => controller.abort();
  }, [client, locked, xpertId]);

  const activeProject = React.useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [activeProjectId, projects],
  );

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredProjects = React.useMemo(
    () =>
      projects.filter((project) => {
        if (!normalizedQuery) return true;
        return project.name.toLocaleLowerCase().includes(normalizedQuery);
      }),
    [normalizedQuery, projects],
  );

  const hasAvailableProjects = locked
    ? Boolean(activeProjectId)
    : loadedFor?.client === client &&
      loadedFor.xpertId === xpertId &&
      !loadFailed &&
      projects.length > 0;
  const projectRailAvailable = hasAvailableProjects || Boolean(onProjectCreate);
  const isLoadingProjects =
    !locked && Boolean(client && xpertId) && loadedFor === null && !loadFailed;

  React.useEffect(() => {
    onAvailabilityChange?.(projectRailAvailable);
  }, [onAvailabilityChange, projectRailAvailable]);

  if (locked && activeProjectId) {
    return (
      <div
        data-slot="composer-project-rail"
        className="flex h-10 min-w-0 items-center px-1"
      >
        <div
          data-slot="composer-project-locked"
          className="inline-flex h-5 max-w-full items-center gap-1.5 rounded-sm px-2 text-sm text-muted-foreground"
          title={lockedProjectLabel || activeProjectId}
        >
          <FolderLock className="size-3.5 shrink-0" />
          <span className="truncate">
            {lockedProjectLabel || activeProjectId}
          </span>
        </div>
      </div>
    );
  }

  if (!projectRailAvailable) return null;

  return (
    <div
      data-slot="composer-project-rail"
      className="flex h-10 min-w-0 items-center px-1"
    >
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setQuery('');
            setCreateMode(false);
            setNewProjectName('');
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled || !client || !xpertId}
            className="inline-flex h-5 max-w-full items-center gap-1.5 rounded-sm px-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t('composer.projects.select')}
          >
            <Folder className="size-3.5 shrink-0" />
            <span className="truncate">
              {activeProject?.name ?? t('composer.projects.select')}
            </span>
            <ChevronDown className="size-3.5 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={8}
          className={cn(
            'flex max-h-(--radix-popover-content-available-height) w-64 max-w-[calc(100vw-1rem)] overflow-hidden border-0 bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10',
            panelRoundedClass,
          )}
        >
          <div
            data-slot="composer-project-command"
            className="flex min-h-0 w-full flex-col overflow-hidden"
          >
            {createMode ? (
              <form
                data-slot="composer-project-create-form"
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const name = newProjectName.trim();
                  if (!name || disabled) return;
                  onProjectCreate?.(name);
                  setOpen(false);
                }}
              >
                <Input
                  autoFocus
                  value={newProjectName}
                  maxLength={120}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  placeholder={t('composer.projects.namePlaceholder')}
                  aria-label={t('composer.projects.namePlaceholder')}
                  className={cn(
                    'h-10 border-0 bg-muted px-3 text-sm shadow-none focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0',
                    menuItemRoundedClass,
                  )}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      setCreateMode(false);
                      setNewProjectName('');
                    }}
                  >
                    {t('composer.projects.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={!newProjectName.trim()}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('composer.projects.create')}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div
                  data-slot="composer-project-search"
                  className="relative mb-2 shrink-0"
                >
                  <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    autoFocus
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t('composer.projects.search')}
                    className={cn(
                      'h-10 border-0 bg-muted pl-9 pr-3 text-sm shadow-none focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0',
                      menuItemRoundedClass,
                    )}
                  />
                </div>
                <div
                  data-slot="composer-project-scroll-region"
                  className="min-h-0 flex-1 max-h-75 overflow-y-auto overscroll-contain"
                >
                  <div
                    data-slot="composer-project-list"
                    className="flex flex-col"
                  >
                    {activeProjectId && !normalizedQuery ? (
                      <button
                        type="button"
                        data-slot="composer-project-clear"
                        className={cn(
                          'relative flex w-full cursor-default select-none items-center gap-3 px-1.5 py-1.5 text-left text-base outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground',
                          menuItemRoundedClass,
                        )}
                        onClick={() => {
                          if (disabled) return;
                          onProjectChange?.(null);
                          setOpen(false);
                        }}
                      >
                        <FolderX className="size-5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate font-normal">
                          {t('composer.projects.none')}
                        </span>
                      </button>
                    ) : null}

                    {isLoadingProjects ? (
                      <ProjectMessage>
                        {t('composer.projects.loading')}
                      </ProjectMessage>
                    ) : loadFailed ? (
                      <ProjectMessage>
                        {t('composer.projects.loadError')}
                      </ProjectMessage>
                    ) : filteredProjects.length === 0 ? (
                      <ProjectMessage>
                        {t('composer.projects.empty')}
                      </ProjectMessage>
                    ) : (
                      filteredProjects.map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          data-slot="composer-project-item"
                          className={cn(
                            'relative flex w-full cursor-default select-none items-center gap-3 px-1.5 py-1.5 text-left text-base outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground',
                            menuItemRoundedClass,
                            project.id === activeProjectId &&
                              'bg-accent text-accent-foreground',
                          )}
                          onClick={() => {
                            if (disabled) return;
                            if (project.id !== activeProjectId) {
                              onProjectChange?.(project.id);
                            }
                            setOpen(false);
                          }}
                        >
                          <Folder className="size-5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate font-normal">
                            {project.name}
                          </span>
                          {project.id === activeProjectId ? (
                            <Check className="size-4 shrink-0" />
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                </div>
                {onProjectCreate ? (
                  <button
                    type="button"
                    data-slot="composer-project-create"
                    className="mt-1 flex w-full shrink-0 items-center gap-3 border-t border-border px-1.5 py-1.5 text-left text-sm font-normal outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
                    onClick={() => setCreateMode(true)}
                  >
                    <Plus className="size-4 shrink-0" />
                    <span>{t('composer.projects.new')}</span>
                  </button>
                ) : null}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ProjectMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-24 items-center justify-center px-4 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
