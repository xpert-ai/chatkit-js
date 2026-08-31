import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Client } from '@xpert-ai/xpert-sdk';
import { ProjectSelector } from './ProjectSelector';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
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
      })[key] ?? key,
  }),
}));

vi.mock('../../providers/Theme', () => ({
  useTheme: () => ({ theme: { radius: 'soft' } }),
}));

function createClient(
  projects: Array<{
    id: string;
    name: string;
    description?: string;
    status: 'active';
  }>,
) {
  return {
    projects: {
      list: vi
        .fn()
        .mockResolvedValue({ items: projects, total: projects.length }),
      get: vi.fn(),
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
      'w-64',
      'border-0',
      'p-1',
      'shadow-md',
      'ring-1',
      'ring-foreground/10',
      'rounded-lg',
    );
    expect(
      document.querySelector('[data-slot="composer-project-command"]'),
    ).toHaveClass('overflow-hidden');
    expect(
      document.querySelector('[data-slot="composer-project-search"]'),
    ).toHaveClass('relative', 'mb-2');
    expect(screen.getByPlaceholderText('Search projects')).toHaveClass(
      'rounded-md',
      'bg-muted',
      'focus-visible:border-transparent',
      'focus-visible:ring-0',
      'focus-visible:ring-offset-0',
    );
    expect(
      document.querySelector('[data-slot="composer-project-item"]'),
    ).toHaveClass('gap-3', 'rounded-md', 'px-1.5', 'py-1.5', 'text-base');
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
        take: 100,
      }),
    );
  });

  it('loads every server page so projects after the first 100 remain searchable', async () => {
    const projects = Array.from({ length: 101 }, (_, index) => ({
      id: `project-${index + 1}`,
      name: `Project ${String(index + 1).padStart(3, '0')}`,
      status: 'active' as const,
    }));
    const client = createClient([]);
    vi.mocked(client.projects.list).mockImplementation(
      async ({ skip = 0, take = 100 }) => ({
        items: projects.slice(skip, skip + take),
        total: projects.length,
      }),
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
    await waitFor(() => expect(client.projects.list).toHaveBeenCalledTimes(2));
    fireEvent.change(search, { target: { value: 'Project 101' } });
    fireEvent.click(await screen.findByRole('button', { name: /Project 101/ }));

    expect(client.projects.list).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        xpertId: 'xpert-1',
        status: 'active',
        skip: 0,
        take: 100,
      }),
    );
    expect(client.projects.list).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        xpertId: 'xpert-1',
        status: 'active',
        skip: 100,
        take: 100,
      }),
    );
    expect(onProjectChange).toHaveBeenCalledWith('project-101');
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
    expect(createProject).toHaveClass(
      'border-t',
      'px-1.5',
      'py-1.5',
      'font-normal',
    );
    expect(createProject).not.toHaveClass(
      'font-medium',
      'font-semibold',
      'font-bold',
    );
    expect(createProject).not.toHaveClass('rounded-md', 'rounded-lg');
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
