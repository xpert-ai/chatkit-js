import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type {
  Client,
  XpertProject,
  XpertProjectTypeCatalog,
} from '@xpert-ai/xpert-sdk';
import { ProjectSelector } from './ProjectSelector';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) =>
      ({
        'composer.projects.select': 'Select project',
        'composer.projects.none': 'No project',
        'composer.projects.search': 'Search projects',
        'composer.projects.new': 'New project',
        'composer.projects.create': 'Create',
        'composer.projects.cancel': 'Cancel',
        'composer.projects.namePlaceholder': 'Project name',
        'composer.projects.loading': 'Loading projects...',
        'composer.projects.empty': 'No projects available',
        'composer.projects.loadError': 'Failed to load projects',
        'composer.projects.grouped': 'By type',
        'composer.projects.recent': 'Recently updated',
        'composer.projects.unclassified': 'Unclassified',
        'composer.projects.clearFilter': 'Clear type filter',
        'composer.projects.loadMore': 'Load more',
        'composer.projects.retry': 'Retry',
        'composer.projects.loadMoreError': 'Failed to load more projects',
        'composer.projects.application': 'Application',
        'composer.projects.type': 'Project type',
        'composer.projects.filters': 'Filter application and type',
      })[key] ?? key,
  }),
}));

vi.mock('../../providers/Theme', () => ({
  useTheme: () => ({ theme: { radius: 'soft' } }),
}));

function createClient(
  projects: XpertProject[],
  catalog?: XpertProjectTypeCatalog,
) {
  return {
    projects: {
      list: vi.fn(
        async ({
          search = '',
          skip = 0,
          take = 20,
          applicationKey,
          projectTypeKey,
          unclassified,
        }) => {
          const items = projects.filter(
            (project) =>
              project.name.includes(search) &&
              (!applicationKey || project.applicationKey === applicationKey) &&
              (!projectTypeKey || project.projectTypeKey === projectTypeKey) &&
              (!unclassified ||
                (!project.applicationKey && !project.projectTypeKey)),
          );
          return { items: items.slice(skip, skip + take), total: items.length };
        },
      ),
      ...(catalog ? { types: vi.fn().mockResolvedValue(catalog) } : {}),
      get: vi.fn(
        async (id: string) =>
          projects.find((project) => project.id === id) ?? {
            id,
            name: id,
            status: 'active',
          },
      ),
    },
  } as unknown as Client;
}

describe('ProjectSelector', () => {
  it('renders a configured Project as a fixed scope without loading choices', () => {
    const client = createClient([]);

    render(
      <ProjectSelector
        client={client}
        xpertId="xpert-1"
        activeProjectId="project-1"
        locked
        label="Launch workspace"
      />,
    );

    expect(screen.getByText('Launch workspace')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Select project' }),
    ).not.toBeInTheDocument();
    expect(client.projects.list).not.toHaveBeenCalled();
  });

  it('loads the active project and changes project from a searchable popover', async () => {
    const client = createClient([
      {
        id: 'project-1',
        name: 'First project',
        status: 'active',
      },
      {
        id: 'project-2',
        name: 'Second project',
        description: 'Customer operations',
        status: 'active',
      },
    ]);
    const onProjectChange = vi.fn();
    render(
      <ProjectSelector
        client={client}
        xpertId="xpert-1"
        activeProjectId="project-1"
        onProjectChange={onProjectChange}
      />,
    );

    await screen.findByText('First project');

    const trigger = screen.getByRole('button', { name: 'Select project' });
    fireEvent.click(trigger);
    fireEvent.change(screen.getByPlaceholderText('Search projects'), {
      target: { value: 'Second' },
    });
    const popover = document.querySelector('[data-slot="popover-content"]');
    expect(popover).not.toBeNull();
    expect(popover).toHaveClass(
      'w-80',
      'border',
      'p-1',
      'shadow-md',
      'rounded-lg',
    );
    expect(
      document.querySelector('[data-slot="composer-project-command"]'),
    ).toHaveClass('overflow-hidden');
    expect(
      document.querySelector('[data-slot="composer-project-search"]'),
    ).toHaveClass('relative');
    expect(screen.getByPlaceholderText('Search projects')).toHaveClass(
      'rounded-md',
      'bg-transparent',
      'focus-visible:border-transparent',
      'focus-visible:ring-0',
      'focus-visible:ring-offset-0',
    );
    await screen.findByText('Second project');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Second project' }),
      ).toBeEnabled(),
    );
    expect(
      document.querySelector('[data-slot="composer-project-item"]'),
    ).toHaveClass('gap-3', 'rounded-md', 'px-1.5', 'py-1', 'text-sm');
    expect(screen.getByText('Second project')).toHaveClass('font-normal');
    expect(screen.getByText('Second project')).not.toHaveClass(
      'font-medium',
      'font-semibold',
      'font-bold',
    );
    expect(
      document.querySelector('[data-slot="composer-project-list"]'),
    ).toHaveClass('flex', 'flex-col');
    expect(
      document.querySelector('[data-slot="composer-project-list"]'),
    ).not.toHaveClass('space-y-1');
    expect(screen.queryByText('Customer operations')).not.toBeInTheDocument();
    expect(
      within(popover as HTMLElement).queryByText('First project'),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Second project/ }));

    expect(onProjectChange).toHaveBeenCalledTimes(1);
    expect(onProjectChange).toHaveBeenCalledWith('project-2');
    expect(client.projects.list).toHaveBeenCalledWith(
      expect.objectContaining({
        xpertId: 'xpert-1',
        status: 'active',
        skip: 0,
        take: 20,
      }),
    );
  });

  it('searches beyond the first page on the server without downloading all projects', async () => {
    const projects = Array.from({ length: 101 }, (_, index) => ({
      id: `project-${index + 1}`,
      name: `Project ${String(index + 1).padStart(3, '0')}`,
      status: 'active' as const,
    }));
    const client = createClient([]);
    vi.mocked(client.projects.list).mockImplementation(
      async ({ skip = 0, take = 100, search = '' }) => {
        const filtered = projects.filter((project) =>
          project.name.includes(search),
        );
        return {
          items: filtered.slice(skip, skip + take),
          total: filtered.length,
        };
      },
    );
    const onProjectChange = vi.fn();

    render(
      <ProjectSelector
        client={client}
        xpertId="xpert-1"
        onProjectChange={onProjectChange}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Select project' }),
    );
    const search = screen.getByPlaceholderText('Search projects');
    await waitFor(() => expect(client.projects.list).toHaveBeenCalledTimes(1));
    fireEvent.change(search, { target: { value: 'Project 101' } });
    fireEvent.click(await screen.findByRole('button', { name: /Project 101/ }));

    expect(client.projects.list).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        xpertId: 'xpert-1',
        status: 'active',
        skip: 0,
        take: 20,
      }),
    );
    expect(client.projects.list).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        xpertId: 'xpert-1',
        status: 'active',
        skip: 0,
        take: 20,
        search: 'Project 101',
      }),
    );
    expect(onProjectChange).toHaveBeenCalledWith('project-101');
  });

  it('keeps a long project list scrollable between fixed controls', async () => {
    const client = createClient(
      Array.from({ length: 20 }, (_, index) => ({
        id: `project-${index + 1}`,
        name: `Project ${index + 1}`,
        status: 'active' as const,
      })),
    );

    render(
      <ProjectSelector
        client={client}
        xpertId="xpert-1"
        onProjectCreate={vi.fn()}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Select project' }),
    );

    const scrollRegion = document.querySelector(
      '[data-slot="composer-project-scroll-region"]',
    );
    expect(scrollRegion).not.toBeNull();
    expect(scrollRegion).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
    expect(
      document.querySelector('[data-slot="composer-project-list-viewport"]'),
    ).toHaveClass('min-h-0', 'max-h-75', 'overflow-hidden');
    expect(
      scrollRegion?.querySelectorAll('[data-slot="composer-project-item"]'),
    ).toHaveLength(20);
    expect(
      scrollRegion?.querySelector('[data-slot="composer-project-search"]'),
    ).not.toBeInTheDocument();
    expect(
      scrollRegion?.querySelector('[data-slot="composer-project-create"]'),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="composer-project-search"]'),
    ).toHaveClass('shrink-0');
    expect(
      document.querySelector('[data-slot="composer-project-create"]'),
    ).toHaveClass('shrink-0');
  });

  it('stays hidden when the current Xpert has no available projects', async () => {
    const client = createClient([]);
    render(<ProjectSelector client={client} xpertId="xpert-1" />);

    await waitFor(() => expect(client.projects.list).toHaveBeenCalledOnce());
    expect(
      screen.queryByRole('button', { name: 'Select project' }),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="composer-project-rail"]'),
    ).not.toBeInTheDocument();
  });

  it('can create a Project even when the Xpert has no existing Projects', async () => {
    const client = createClient([]);
    const onProjectCreate = vi.fn();
    render(
      <ProjectSelector
        client={client}
        xpertId="xpert-1"
        onProjectCreate={onProjectCreate}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Select project' }),
    );
    const createProject = screen.getByRole('button', { name: 'New project' });
    expect(createProject).toHaveClass('px-1.5', 'py-1', 'font-normal');
    expect(createProject).not.toHaveClass(
      'font-medium',
      'font-semibold',
      'font-bold',
    );
    expect(createProject).toHaveClass('rounded-md');
    expect(createProject).not.toHaveClass('border-t');
    fireEvent.click(createProject);
    fireEvent.change(screen.getByLabelText('Project name'), {
      target: { value: '  Launch project  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onProjectCreate).toHaveBeenCalledOnce();
    expect(onProjectCreate).toHaveBeenCalledWith('Launch project');
  });

  it('stays hidden when projects fail to load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const client = createClient([]);
    vi.mocked(client.projects.list).mockRejectedValue(new Error('forbidden'));
    render(<ProjectSelector client={client} xpertId="xpert-1" />);

    await waitFor(() => expect(client.projects.list).toHaveBeenCalledOnce());
    expect(
      screen.queryByRole('button', { name: 'Select project' }),
    ).not.toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith(
      '[Chat] Failed to load projects:',
      expect.any(Error),
    );
    warn.mockRestore();
  });

  it('stays hidden when the installed SDK does not expose project discovery', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const client = {} as Client;

    render(<ProjectSelector client={client} xpertId="xpert-1" />);

    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith(
        '[Chat] Project discovery is unavailable in the installed SDK.',
      ),
    );
    expect(
      screen.queryByRole('button', { name: 'Select project' }),
    ).not.toBeInTheDocument();
    warn.mockRestore();
  });

  it('lets the user clear the selected project before starting a conversation', async () => {
    const client = createClient([
      {
        id: 'project-1',
        name: 'First project',
        status: 'active',
      },
    ]);
    const onProjectChange = vi.fn();
    render(
      <ProjectSelector
        client={client}
        xpertId="xpert-1"
        activeProjectId="project-1"
        onProjectChange={onProjectChange}
      />,
    );

    await screen.findByText('First project');
    fireEvent.click(screen.getByRole('button', { name: 'Select project' }));
    expect(screen.getByText('No project')).toHaveClass('font-normal');
    fireEvent.click(screen.getByRole('button', { name: 'No project' }));

    expect(onProjectChange).toHaveBeenCalledOnce();
    expect(onProjectChange).toHaveBeenCalledWith(null);
  });

  it('closes and cannot change projects after the selector becomes disabled', async () => {
    const client = createClient([
      {
        id: 'project-1',
        name: 'First project',
        status: 'active',
      },
      {
        id: 'project-2',
        name: 'Second project',
        status: 'active',
      },
    ]);
    const onProjectChange = vi.fn();
    const { rerender } = render(
      <ProjectSelector
        client={client}
        xpertId="xpert-1"
        activeProjectId="project-1"
        onProjectChange={onProjectChange}
      />,
    );

    await screen.findByText('First project');
    fireEvent.click(screen.getByRole('button', { name: 'Select project' }));
    expect(screen.getByPlaceholderText('Search projects')).toBeInTheDocument();

    rerender(
      <ProjectSelector
        client={client}
        xpertId="xpert-1"
        activeProjectId="project-1"
        disabled
        onProjectChange={onProjectChange}
      />,
    );

    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText('Search projects'),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', { name: 'Select project' }),
    ).toBeDisabled();
    expect(onProjectChange).not.toHaveBeenCalled();
  });
});

const caseType = {
  applicationKey: 'automotive:operations',
  projectTypeKey: 'case',
  applicationTitle: 'Operations',
  title: 'Case',
  available: true,
  binding: { kind: 'entity' as const, providerKey: 'operations_case' },
};
const caseRef = {
  applicationKey: caseType.applicationKey,
  projectTypeKey: caseType.projectTypeKey,
};

it('uses the Assistant default type and routes creation through the application', async () => {
  const client = createClient([], {
    items: [caseType],
    defaultProjectType: caseRef,
  });
  const onProjectCreate = vi.fn(),
    onProjectTypeCreate = vi.fn();
  render(
    <ProjectSelector
      client={client}
      xpertId="assistant"
      onProjectCreate={onProjectCreate}
      onProjectTypeCreate={onProjectTypeCreate}
    />,
  );
  await waitFor(() =>
    expect(client.projects.list).toHaveBeenCalledWith(
      expect.objectContaining(caseRef),
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Select project' }));
  fireEvent.click(screen.getByRole('button', { name: 'New project · Case' }));
  expect(onProjectTypeCreate).toHaveBeenCalledWith(caseRef);
  expect(onProjectCreate).not.toHaveBeenCalled();
  expect(screen.queryByPlaceholderText('Project name')).not.toBeInTheDocument();
});

it('filters by a clickable type prefix without switching the Project', async () => {
  const client = createClient(
    [
      {
        id: 'case-project',
        name: 'Automotive case',
        status: 'active',
        ...caseRef,
      },
    ],
    { items: [caseType] },
  );
  const onProjectChange = vi.fn();
  render(
    <ProjectSelector
      client={client}
      xpertId="assistant"
      onProjectChange={onProjectChange}
    />,
  );
  await waitFor(() => expect(client.projects.list).toHaveBeenCalled());
  fireEvent.click(
    await screen.findByRole('button', { name: 'Select project' }),
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Operations / Case' }),
  );
  await waitFor(() =>
    expect(client.projects.list).toHaveBeenLastCalledWith(
      expect.objectContaining(caseRef),
    ),
  );
  expect(onProjectChange).not.toHaveBeenCalled();
});

it('does not fall back to generic creation when the type catalog fails', async () => {
  const client = createClient([], {
    items: [caseType],
    defaultProjectType: caseRef,
  });
  vi.mocked(client.projects.types).mockRejectedValue(
    new Error('application unavailable'),
  );
  render(
    <ProjectSelector
      client={client}
      xpertId="assistant"
      onProjectCreate={vi.fn()}
    />,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Select project' }),
  );
  await screen.findByText('Failed to load projects');
  expect(screen.getByRole('button', { name: 'New project' })).toBeDisabled();
  expect(client.projects.list).not.toHaveBeenCalled();
});

function pagedProjects(count = 41): XpertProject[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `case-${index + 1}`,
    name: `Case ${String(index + 1).padStart(3, '0')}`,
    status: 'active',
    ...caseRef,
  }));
}

async function openSelector(client: Client) {
  render(<ProjectSelector client={client} xpertId="assistant" />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Select project' }),
  );
}

it('groups by stable type identity, using the current catalog name instead of old snapshots', async () => {
  const projects = pagedProjects(2);
  projects[0].projectTypeSnapshot = {
    title: 'Old Case',
    applicationTitle: 'Old Operations',
    binding: caseType.binding,
  };
  projects[1].projectTypeSnapshot = {
    title: 'Renamed Case',
    applicationTitle: 'Operations',
    binding: caseType.binding,
  };
  const otherType = {
    ...caseType,
    applicationKey: 'other:operations',
    applicationTitle: 'Other app',
  };
  await openSelector(
    createClient(
      [
        ...projects,
        {
          id: 'other',
          name: 'Another app project',
          status: 'active',
          applicationKey: otherType.applicationKey,
          projectTypeKey: 'case',
        },
        { id: 'legacy', name: 'Legacy project', status: 'active' },
      ],
      { items: [caseType, otherType] },
    ),
  );

  const group = await screen.findByRole('region', {
    name: 'Operations / Case',
  });
  expect(within(group).getAllByRole('button')).toHaveLength(4);
  expect(
    screen.getAllByRole('button', { name: 'Operations / Case' }),
  ).toHaveLength(1);
  expect(
    screen.queryByText('Old Operations / Old Case'),
  ).not.toBeInTheDocument();
  expect(
    within(screen.getByRole('region', { name: 'Other app / Case' })).getByText(
      'Another app project',
    ),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole('region', { name: 'Unclassified' })).getByText(
      'Legacy project',
    ),
  ).toBeInTheDocument();
});

it('merges subsequent pages into one group without replacing earlier choices', async () => {
  const client = createClient(pagedProjects(), { items: [caseType] });
  await openSelector(client);
  await screen.findByText('Case 020');
  expect(screen.queryByText('Case 021')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByText('Case 040');
  expect(screen.getByText('Case 001')).toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: 'Operations / Case' }),
  ).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByText('Case 041');
  expect(
    document.querySelectorAll('[data-slot="composer-project-item"]'),
  ).toHaveLength(41);
  expect(
    screen.queryByRole('button', { name: 'Load more' }),
  ).not.toBeInTheDocument();
  expect(
    vi.mocked(client.projects.list).mock.calls.map(([input]) => input.skip),
  ).toEqual([0, 20, 40]);
});

it('keeps loaded choices during a failed next page and retries the same offset', async () => {
  const client = createClient(pagedProjects(), { items: [caseType] });
  await openSelector(client);
  await screen.findByText('Case 020');
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.mocked(client.projects.list).mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByText('Failed to load more projects');
  expect(screen.getByText('Case 001')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('Case 040');
  expect(
    document.querySelectorAll('[data-slot="composer-project-item"]'),
  ).toHaveLength(40);
  expect(
    vi.mocked(client.projects.list).mock.calls.map(([input]) => input.skip),
  ).toEqual([0, 20, 20]);
  warn.mockRestore();
});

it('resets pagination for server search and ignores an old page arriving afterward', async () => {
  const client = createClient(pagedProjects(), { items: [caseType] });
  await openSelector(client);
  await screen.findByText('Case 020');
  let resolvePage!: (value: { items: XpertProject[]; total: number }) => void;
  vi.mocked(client.projects.list).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolvePage = resolve;
      }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await waitFor(() => expect(client.projects.list).toHaveBeenCalledTimes(2));
  expect(
    screen.getByRole('button', { name: 'Loading projects...' }),
  ).toBeDisabled();
  expect(screen.getByText('Case 001')).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText('Search projects'), {
    target: { value: '041' },
  });
  await screen.findByText('Case 041');
  await act(async () =>
    resolvePage({ items: pagedProjects().slice(20, 40), total: 41 }),
  );
  expect(
    document.querySelectorAll('[data-slot="composer-project-item"]'),
  ).toHaveLength(1);
  expect(screen.queryByText('Case 021')).not.toBeInTheDocument();
  expect(client.projects.list).toHaveBeenLastCalledWith(
    expect.objectContaining({ skip: 0, search: '041' }),
  );
});

it('loads a type from its first page when its group header is clicked and can clear that filter', async () => {
  const client = createClient(pagedProjects(), { items: [caseType] });
  await openSelector(client);
  await screen.findByText('Case 020');
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByText('Case 040');
  fireEvent.click(screen.getByRole('button', { name: 'Operations / Case' }));
  await waitFor(() =>
    expect(client.projects.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ skip: 0, ...caseRef }),
    ),
  );
  await waitFor(() =>
    expect(screen.queryByText('Case 040')).not.toBeInTheDocument(),
  );
  fireEvent.click(
    within(screen.getByRole('region', { name: 'Operations / Case' })).getByRole(
      'button',
      { name: 'Clear type filter' },
    ),
  );
  await waitFor(() =>
    expect(
      vi.mocked(client.projects.list).mock.lastCall?.[0].applicationKey,
    ).toBeUndefined(),
  );
});

it('switches between grouped and recent views without duplicating projects or losing loaded pages', async () => {
  const client = createClient(
    pagedProjects(22).map((project, i) =>
      i % 2
        ? { ...project, applicationKey: null, projectTypeKey: null }
        : project,
    ),
    { items: [caseType] },
  );
  await openSelector(client);
  await screen.findByText('Case 020');
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByText('Case 022');
  fireEvent.click(screen.getByRole('button', { name: 'Recently updated' }));
  expect(
    screen.getByRole('button', { name: 'Recently updated' }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(
    screen.queryByRole('region', { name: 'Operations / Case' }),
  ).not.toBeInTheDocument();
  expect(
    Array.from(
      document.querySelectorAll('[data-slot="composer-project-item"]'),
    ).map((row) => row.textContent),
  ).toEqual(pagedProjects(22).map((project) => project.name));
  fireEvent.click(screen.getByRole('button', { name: 'By type' }));
  expect(
    screen.getAllByRole('button', { name: 'Operations / Case' }),
  ).toHaveLength(1);
  expect(
    document.querySelectorAll('[data-slot="composer-project-item"]'),
  ).toHaveLength(22);
  expect(client.projects.list).toHaveBeenCalledTimes(2);
});

it('deduplicates overlapping pages while advancing the server offset', async () => {
  const client = createClient(pagedProjects(), { items: [caseType] });
  await openSelector(client);
  await screen.findByText('Case 020');
  vi.mocked(client.projects.list).mockResolvedValueOnce({
    items: pagedProjects().slice(19, 39),
    total: 41,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByText('Case 039');
  expect(screen.getAllByText('Case 020')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByText('Case 041');
  expect(client.projects.list).toHaveBeenLastCalledWith(
    expect.objectContaining({ skip: 40 }),
  );
});

it('keeps advanced filters compact and supports application and unclassified selection', async () => {
  const client = createClient(
    [
      ...pagedProjects(2),
      { id: 'legacy', name: 'Legacy project', status: 'active' },
    ],
    { items: [caseType] },
  );
  await openSelector(client);
  await screen.findByText('Legacy project');
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Filter application and type' }),
  );
  expect(
    screen.getByRole('button', { name: 'Filter application and type' }),
  ).toHaveAttribute('aria-expanded', 'true');
  fireEvent.change(screen.getByRole('combobox', { name: 'Application' }), {
    target: { value: '__unclassified' },
  });
  await waitFor(() =>
    expect(client.projects.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ skip: 0, unclassified: true }),
    ),
  );
  await waitFor(() =>
    expect(screen.queryByText('Case 001')).not.toBeInTheDocument(),
  );
  await screen.findByText('Legacy project');
  fireEvent.change(screen.getByRole('combobox', { name: 'Application' }), {
    target: { value: caseType.applicationKey },
  });
  await screen.findByText('Case 001');
  fireEvent.change(screen.getByRole('combobox', { name: 'Project type' }), {
    target: { value: 'case' },
  });
  await waitFor(() =>
    expect(client.projects.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ skip: 0, ...caseRef }),
    ),
  );
});
