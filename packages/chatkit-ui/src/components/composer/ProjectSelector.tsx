import { resolveLocalizedText } from '../../i18n/localized-text';
import * as React from 'react';
import {
  Check,
  ChevronDown,
  Folder,
  FolderLock,
  LoaderCircle,
  Plus,
  Search,
} from 'lucide-react';
import type {
  Client,
  XpertProject,
  XpertProjectTypeRef,
  XpertProjectTypeSummary,
} from '@xpert-ai/xpert-sdk';

import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import {
  cn,
  getMenuItemRoundedClass,
  getPanelRoundedClass,
} from '../../lib/utils';
import { useTheme } from '../../providers/Theme';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Separator } from '../ui/separator';
import { groupProjects } from './project-groups';
import { ProjectFilterButton } from './ProjectFilterButton';
import { ProjectListViewport } from './ProjectListViewport';

export type ProjectSelectorProps = {
  client: Client | null;
  xpertId?: string;
  activeProjectId?: string | null;
  disabled?: boolean;
  locked?: boolean;
  label?: string;
  onAvailabilityChange?: (available: boolean) => void;
  onProjectChange?: (projectId: string | null) => void;
  onProjectCreate?: (name: string, projectType?: XpertProjectTypeRef) => void;
  onProjectTypeCreate?: (projectType: XpertProjectTypeRef) => void;
};

const PROJECT_PAGE_SIZE = 20;

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
  onProjectTypeCreate,
}: ProjectSelectorProps) {
  const { t, i18n } = useChatkitTranslation();
  const { theme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [createMode, setCreateMode] = React.useState(false);
  const [newProjectName, setNewProjectName] = React.useState('');
  const [projects, setProjects] = React.useState<XpertProject[]>([]);
  const [types, setTypes] = React.useState<XpertProjectTypeSummary[]>([]);
  const [defaultType, setDefaultType] = React.useState<
    XpertProjectTypeRef | undefined
  >();
  const [applicationKey, setApplicationKey] = React.useState('');
  const [projectTypeKey, setProjectTypeKey] = React.useState('');
  const [skip, setSkip] = React.useState(0);
  const [total, setTotal] = React.useState(0);
  const [nextSkip, setNextSkip] = React.useState<number | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [hasDiscoveredProjects, setHasDiscoveredProjects] =
    React.useState(false);
  const [retry, setRetry] = React.useState(0);
  const [view, setView] = React.useState<'grouped' | 'recent'>('grouped');
  const [showFilters, setShowFilters] = React.useState(false);
  const [catalogReady, setCatalogReady] = React.useState(false);
  const [catalogFailed, setCatalogFailed] = React.useState(false);
  const [activeLabel, setActiveLabel] = React.useState(label);
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
    // Retain data for filter changes, but never carry choices into another client or Assistant scope.
    setProjects([]);
    setLoadedFor(null);
    setTotal(0);
    setNextSkip(null);
    setHasDiscoveredProjects(false);
    setTypes([]);
    setDefaultType(undefined);
    setApplicationKey('');
    setProjectTypeKey('');
    setSkip(0);
    setCatalogReady(false);
    setCatalogFailed(false);
    if (!client || !xpertId || locked) {
      setCatalogReady(true);
      return;
    }
    const controller = new AbortController();
    // Older hosts may still expose only the unclassified Project list.
    if (!client.projects?.types) {
      setCatalogReady(true);
      return;
    }
    client.projects
      .types({ xpertId, signal: controller.signal })
      .then((catalog) => {
        if (controller.signal.aborted) return;
        setTypes(catalog.items);
        setDefaultType(catalog.defaultProjectType);
        setApplicationKey(catalog.defaultProjectType?.applicationKey ?? '');
        setProjectTypeKey(catalog.defaultProjectType?.projectTypeKey ?? '');
        setCatalogReady(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCatalogFailed(true);
        }
      });
    return () => controller.abort();
  }, [client, xpertId, locked]);

  React.useEffect(() => {
    if (locked || !activeProjectId || !client?.projects?.get) {
      setActiveLabel(label);
      return;
    }
    const controller = new AbortController();
    client.projects
      .get(activeProjectId, { signal: controller.signal })
      .then((project) => {
        if (!controller.signal.aborted) setActiveLabel(project.name);
      })
      .catch(() => {
        if (!controller.signal.aborted) setActiveLabel(label);
      });
    return () => controller.abort();
  }, [client, activeProjectId, label, locked]);

  React.useEffect(() => {
    if (locked) {
      setProjects([]);
      setLoadFailed(false);
      setLoadedFor(null);
      setRefreshing(false);
      return;
    }
    if (!client || !xpertId || !catalogReady) {
      setProjects([]);
      setLoadFailed(false);
      setLoadedFor(null);
      setRefreshing(false);
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
    setLoadFailed(false);
    setLoadingMore(skip > 0);
    // Keep the mounted list and its dimensions until the next response replaces it atomically.
    setRefreshing(skip === 0);

    const timer = setTimeout(
      () =>
        projectsClient
          .list({
            xpertId,
            status: 'active',
            skip,
            take: PROJECT_PAGE_SIZE,
            signal: controller.signal,
            ...(query.trim() ? { search: query.trim() } : {}),
            ...(applicationKey && applicationKey !== '__unclassified'
              ? { applicationKey }
              : {}),
            ...(projectTypeKey ? { projectTypeKey } : {}),
            ...(applicationKey === '__unclassified'
              ? { unclassified: true }
              : {}),
          })
          .then((result) => {
            if (controller.signal.aborted) return;
            setProjects((previous) =>
              skip === 0
                ? result.items
                : Array.from(
                    new Map(
                      [...previous, ...result.items].map((project) => [
                        project.id,
                        project,
                      ]),
                    ).values(),
                  ),
            );
            setTotal(result.total);
            const offset = skip + result.items.length;
            setNextSkip(
              result.items.length > 0 && offset < result.total ? offset : null,
            );
            setLoadingMore(false);
            setRefreshing(false);
            if (result.items.length > 0) setHasDiscoveredProjects(true);
            setLoadedFor({ client, xpertId });
          })
          .catch((loadError) => {
            if (controller.signal.aborted) return;
            console.warn('[Chat] Failed to load projects:', loadError);
            setLoadingMore(false);
            setRefreshing(false);
            setLoadFailed(true);
            setLoadedFor({ client, xpertId });
          }),
      query.trim() ? 200 : 0,
    );

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    client,
    locked,
    xpertId,
    catalogReady,
    query,
    applicationKey,
    projectTypeKey,
    skip,
    retry,
  ]);

  const activeProject = React.useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [activeProjectId, projects],
  );

  const groups = React.useMemo(
    () =>
      groupProjects(
        projects,
        types,
        i18n.language,
        t('composer.projects.unclassified'),
      ),
    [projects, types, i18n.language, t],
  );
  const applications = Array.from(
    new Map(types.map((type) => [type.applicationKey, type.applicationTitle])),
  );
  const localized = (text: XpertProjectTypeSummary['title']) =>
    resolveLocalizedText(text, i18n.language) ?? '';
  const scopedTypes = types.filter(
    (type) => type.applicationKey === applicationKey,
  );
  const creationRef =
    applicationKey && applicationKey !== '__unclassified'
      ? {
          applicationKey,
          projectTypeKey:
            projectTypeKey ||
            (scopedTypes.length === 1 ? scopedTypes[0].projectTypeKey : ''),
        }
      : (defaultType ?? {
          applicationKey: 'platform',
          projectTypeKey: 'general',
        });
  const creationType = types.find(
    (type) =>
      type.applicationKey === creationRef.applicationKey &&
      type.projectTypeKey === creationRef.projectTypeKey,
  );
  const canCreate =
    catalogReady &&
    !catalogFailed &&
    (types.length === 0 || Boolean(creationType?.available)) &&
    (creationType?.binding.kind === 'entity'
      ? Boolean(onProjectTypeCreate)
      : Boolean(onProjectCreate));
  const hasAvailableProjects = locked
    ? Boolean(activeProjectId)
    : loadedFor?.client === client &&
      loadedFor.xpertId === xpertId &&
      hasDiscoveredProjects;
  const projectRailAvailable =
    hasAvailableProjects ||
    Boolean(onProjectCreate) ||
    types.length > 0 ||
    Boolean(activeProjectId);
  const isLoadingProjects =
    !locked &&
    Boolean(client && xpertId) &&
    loadedFor === null &&
    !loadFailed &&
    !catalogFailed;

  React.useEffect(() => {
    onAvailabilityChange?.(projectRailAvailable);
  }, [onAvailabilityChange, projectRailAvailable]);

  /** Reset only the type scope; the user's search and selected Project remain intact. */
  const clearTypeFilter = () => {
    setApplicationKey('');
    setProjectTypeKey('');
    setSkip(0);
  };
  const staleProjects = refreshing || (loadFailed && skip === 0);

  const renderProject = (project: XpertProject) => (
    <button
      key={project.id}
      type="button"
      data-slot="composer-project-item"
      title={project.name}
      disabled={disabled || staleProjects}
      className={cn(
        'relative flex w-full cursor-default select-none items-center gap-3 px-1.5 py-1 text-left text-base outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground',
        menuItemRoundedClass,
        project.id === activeProjectId && 'bg-accent text-accent-foreground',
      )}
      onClick={() => {
        if (disabled || staleProjects) return;
        if (project.id !== activeProjectId) onProjectChange?.(project.id);
        setOpen(false);
      }}
    >
      <span className="min-w-0 flex-1 truncate font-normal">
        {project.name}
      </span>
      {project.id === activeProjectId ? (
        <Check className="size-4 shrink-0" />
      ) : null}
    </button>
  );

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
            setSkip(0);
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
              {activeProject?.name ??
                activeLabel ??
                t('composer.projects.select')}
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
            'flex max-h-(--radix-popover-content-available-height) w-80 max-w-[calc(100vw-1rem)] overflow-hidden bg-popover p-1 text-popover-foreground shadow-md',
            panelRoundedClass,
          )}
        >
          <div
            data-slot="composer-project-command"
            className="flex min-h-0 w-full flex-col overflow-hidden"
          >
            {!createMode && showFilters && types.length > 0 ? (
              <div className="grid gap-1 p-1">
                <select
                  aria-label={t('composer.projects.application')}
                  className="min-w-0 rounded border border-border bg-popover px-2 py-1 text-sm"
                  value={applicationKey}
                  onChange={(event) => {
                    setApplicationKey(event.target.value);
                    setProjectTypeKey('');
                    setSkip(0);
                  }}
                >
                  <option value="">
                    {t('composer.projects.allApplications')}
                  </option>
                  <option value="__unclassified">
                    {t('composer.projects.unclassified')}
                  </option>
                  {applications.map(([key, title]) => (
                    <option key={key} value={key}>
                      {localized(title)}
                    </option>
                  ))}
                </select>
                {applicationKey && applicationKey !== '__unclassified' ? (
                  <select
                    aria-label={t('composer.projects.type')}
                    className="min-w-0 rounded border border-border bg-popover px-2 py-1 text-sm"
                    value={projectTypeKey}
                    onChange={(event) => {
                      setProjectTypeKey(event.target.value);
                      setSkip(0);
                    }}
                  >
                    <option value="">{t('composer.projects.allTypes')}</option>
                    {types
                      .filter((type) => type.applicationKey === applicationKey)
                      .map((type) => (
                        <option
                          key={type.projectTypeKey}
                          value={type.projectTypeKey}
                        >
                          {localized(type.title)}
                        </option>
                      ))}
                  </select>
                ) : null}
              </div>
            ) : null}
            {createMode ? (
              <form
                data-slot="composer-project-create-form"
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const name = newProjectName.trim();
                  if (!name || disabled) return;
                  if (creationType) onProjectCreate?.(name, creationType);
                  else onProjectCreate?.(name);
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
                  {refreshing && !isLoadingProjects ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 animate-spin text-muted-foreground motion-reduce:animate-none"
                    />
                  ) : (
                    <Search
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                  )}
                  <span role="status" className="sr-only">
                    {refreshing ? t('composer.projects.loading') : ''}
                  </span>
                  <Input
                    autoFocus
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setSkip(0);
                    }}
                    placeholder={t('composer.projects.search')}
                    className={cn(
                      'h-10 border-0 bg-muted pl-9 pr-10 text-sm shadow-none focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0',
                      menuItemRoundedClass,
                    )}
                  />
                  {types.length > 0 || applicationKey ? (
                    <ProjectFilterButton
                      active={Boolean(applicationKey)}
                      label={t(
                        applicationKey
                          ? 'composer.projects.clearFilter'
                          : 'composer.projects.filters',
                      )}
                      expanded={applicationKey ? undefined : showFilters}
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={
                        applicationKey
                          ? clearTypeFilter
                          : () => setShowFilters((value) => !value)
                      }
                    />
                  ) : null}
                </div>
                <div
                  role="group"
                  aria-label={t('composer.projects.display')}
                  className="mb-1 flex shrink-0 gap-1 px-1"
                >
                  {(['grouped', 'recent'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={view === mode}
                      className={cn(
                        'flex-1 rounded-md px-2 py-1.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
                        view === mode
                          ? 'bg-accent font-medium text-accent-foreground'
                          : 'text-muted-foreground',
                      )}
                      onClick={() => setView(mode)}
                    >
                      {t(`composer.projects.${mode}`)}
                    </button>
                  ))}
                </div>
                <ProjectListViewport
                  ready={!isLoadingProjects && loadedFor !== null}
                  busy={isLoadingProjects || refreshing || loadingMore}
                  footer={
                    total > PROJECT_PAGE_SIZE ||
                    (loadFailed && projects.length > 0) ? (
                      <div
                        data-slot="composer-project-pagination"
                        className="shrink-0 border-t border-border px-2 py-2 text-xs"
                      >
                        {loadFailed ? (
                          <p
                            role="status"
                            className="mb-1 text-muted-foreground"
                          >
                            {t(
                              skip > 0
                                ? 'composer.projects.loadMoreError'
                                : 'composer.projects.loadError',
                            )}
                          </p>
                        ) : null}
                        <div className="flex items-center justify-between gap-2">
                          <span
                            aria-live="polite"
                            className="text-muted-foreground"
                          >
                            {t('composer.projects.loaded', {
                              count: projects.length,
                              total,
                            })}
                          </span>
                          {nextSkip !== null || loadFailed ? (
                            <button
                              type="button"
                              disabled={loadingMore || refreshing}
                              className="rounded px-2 py-1 font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                              onClick={() => {
                                if (loadFailed) setRetry((value) => value + 1);
                                else if (nextSkip !== null) setSkip(nextSkip);
                              }}
                            >
                              {t(
                                loadingMore
                                  ? 'composer.projects.loading'
                                  : loadFailed
                                    ? 'composer.projects.retry'
                                    : 'composer.projects.loadMore',
                              )}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null
                  }
                >
                  <div
                    data-slot="composer-project-list"
                    className="flex flex-col"
                  >
                    {activeProjectId && !query.trim() ? (
                      <button
                        type="button"
                        data-slot="composer-project-clear"
                        className={cn(
                          'relative flex w-full cursor-default select-none items-center gap-3 px-1.5 py-1 text-left text-base outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground',
                          menuItemRoundedClass,
                        )}
                        onClick={() => {
                          if (disabled) return;
                          onProjectChange?.(null);
                          setOpen(false);
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate font-normal">
                          {t('composer.projects.none')}
                        </span>
                      </button>
                    ) : null}

                    {isLoadingProjects ? (
                      <ProjectMessage>
                        {t('composer.projects.loading')}
                      </ProjectMessage>
                    ) : (loadFailed || catalogFailed) &&
                      projects.length === 0 ? (
                      <ProjectMessage>
                        {t('composer.projects.loadError')}
                      </ProjectMessage>
                    ) : projects.length === 0 ? (
                      <ProjectMessage>
                        {t('composer.projects.empty')}
                      </ProjectMessage>
                    ) : view === 'recent' ? (
                      projects.map(renderProject)
                    ) : (
                      groups.map((group) => {
                        const filtered =
                          applicationKey ===
                            (group.applicationKey ?? '__unclassified') &&
                          (!projectTypeKey ||
                            projectTypeKey === group.projectTypeKey);
                        const filter = () => {
                          setApplicationKey(
                            group.applicationKey ?? '__unclassified',
                          );
                          setProjectTypeKey(group.projectTypeKey ?? '');
                          setSkip(0);
                        };
                        return (
                          <section
                            key={group.key}
                            aria-label={group.label}
                            className="min-w-0 pb-2 last:pb-0"
                          >
                            <div className="sticky top-0 z-10 flex w-full items-center gap-2 bg-popover px-2 text-xs font-medium text-muted-foreground">
                              <button
                                type="button"
                                data-slot="composer-project-group"
                                className="min-w-0 flex-1 truncate py-2 text-left outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                                title={t('composer.projects.filterType')}
                                onClick={filter}
                              >
                                {group.label}
                              </button>
                              <ProjectFilterButton
                                active={filtered}
                                label={t(
                                  filtered
                                    ? 'composer.projects.clearFilter'
                                    : 'composer.projects.filterType',
                                )}
                                onClick={filtered ? clearTypeFilter : filter}
                              />
                            </div>
                            {group.projects.map(renderProject)}
                          </section>
                        );
                      })
                    )}
                  </div>
                </ProjectListViewport>
                {onProjectCreate || onProjectTypeCreate ? (
                  <>
                    <Separator className="mt-1" />
                    <button
                      type="button"
                      data-slot="composer-project-create"
                      disabled={!canCreate}
                      className={cn(
                        'flex w-full shrink-0 items-center gap-3 px-1.5 py-1 text-left text-sm font-normal outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground',
                        menuItemRoundedClass,
                      )}
                      onClick={() => {
                        if (!canCreate) return;
                        if (creationType?.binding.kind === 'entity') {
                          onProjectTypeCreate?.({
                            applicationKey: creationType.applicationKey,
                            projectTypeKey: creationType.projectTypeKey,
                          });
                          setOpen(false);
                        } else setCreateMode(true);
                      }}
                    >
                      <Plus className="size-4 shrink-0" />
                      <span>
                        {creationType
                          ? `${t('composer.projects.new')} · ${localized(creationType.title)}`
                          : t('composer.projects.new')}
                      </span>
                    </button>
                  </>
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
