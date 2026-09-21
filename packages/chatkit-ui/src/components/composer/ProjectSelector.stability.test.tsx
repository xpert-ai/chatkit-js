import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { Client, XpertProject } from '@xpert-ai/xpert-sdk';
import { describe, expect, it, vi } from 'vitest';
import { ProjectSelector } from './ProjectSelector';
import { ProjectListViewport } from './ProjectListViewport';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) =>
      ({
        'composer.projects.select': 'Select project',
        'composer.projects.search': 'Search projects',
        'composer.projects.empty': 'No projects available',
        'composer.projects.clearFilter': 'Clear type filter',
        'composer.projects.filters': 'Filter application and type',
        'composer.projects.filterType': 'Filter by type',
        'composer.projects.grouped': 'By type',
        'composer.projects.recent': 'Recently updated',
        'composer.projects.loadError': 'Failed to load projects',
        'composer.projects.retry': 'Retry',
      })[key] ?? key,
  }),
}));
vi.mock('../../providers/Theme', () => ({
  useTheme: () => ({ theme: { radius: 'soft' } }),
}));

const type = {
  applicationKey: 'operations',
  projectTypeKey: 'case',
  applicationTitle: 'Operations',
  title: 'Case',
  available: true,
  binding: { kind: 'entity' as const, providerKey: 'case' },
};
const choices: XpertProject[] = [
  {
    id: 'case-1',
    name: 'First case',
    status: 'active',
    applicationKey: type.applicationKey,
    projectTypeKey: type.projectTypeKey,
  },
  {
    id: 'case-2',
    name: 'Second case',
    status: 'active',
    applicationKey: type.applicationKey,
    projectTypeKey: type.projectTypeKey,
  },
];
type Page = Awaited<ReturnType<Client['projects']['list']>>;
function clientFixture(withCatalog = true) {
  return {
    projects: {
      list: vi
        .fn<Client['projects']['list']>()
        .mockResolvedValue({ items: choices, total: choices.length }),
      ...(withCatalog
        ? { types: vi.fn().mockResolvedValue({ items: [type] }) }
        : {}),
      get: vi.fn().mockResolvedValue(choices[0]),
    },
  } as unknown as Client;
}
function deferredPage() {
  let resolve!: (page: Page) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Page>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function open(client: Client, onAvailabilityChange = vi.fn()) {
  render(
    <ProjectSelector
      client={client}
      xpertId="assistant"
      onAvailabilityChange={onAvailabilityChange}
    />,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Select project' }),
  );
  await screen.findByText('First case');
}

describe('Project selector stability', () => {
  it('retains the mounted panel and rows until a filter result arrives, without toggling availability', async () => {
    const client = clientFixture(false);
    const availability = vi.fn();
    await open(client, availability);
    availability.mockClear();
    const panel = document.querySelector('[data-slot="popover-content"]');
    const row = screen.getByRole('button', { name: 'First case' });
    expect(row.querySelector('svg')).toBeNull();
    const page = deferredPage();
    vi.mocked(client.projects.list).mockReturnValueOnce(page.promise);
    fireEvent.change(screen.getByPlaceholderText('Search projects'), {
      target: { value: 'Second' },
    });
    await waitFor(() => expect(client.projects.list).toHaveBeenCalledTimes(2));
    expect(document.querySelector('[data-slot="popover-content"]')).toBe(panel);
    expect(screen.getByRole('button', { name: 'First case' })).toBe(row);
    expect(row).toBeDisabled();
    expect(
      document.querySelector('[data-slot="composer-project-list-viewport"]'),
    ).toHaveAttribute('aria-busy', 'true');
    await act(async () => page.resolve({ items: [choices[1]], total: 1 }));
    expect(document.querySelector('[data-slot="popover-content"]')).toBe(panel);
    expect(screen.queryByText('First case')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Second case' })).toBeEnabled();
    expect(availability).not.toHaveBeenCalledWith(false);
  });

  it('keeps an empty search open and permits another search when creation and catalog are unavailable', async () => {
    const client = clientFixture(false);
    await open(client);
    const panel = document.querySelector('[data-slot="popover-content"]');
    vi.mocked(client.projects.list).mockResolvedValueOnce({
      items: [],
      total: 0,
    });
    fireEvent.change(screen.getByPlaceholderText('Search projects'), {
      target: { value: 'missing' },
    });
    await screen.findByText('No projects available');
    expect(document.querySelector('[data-slot="popover-content"]')).toBe(panel);
    fireEvent.change(screen.getByPlaceholderText('Search projects'), {
      target: { value: '' },
    });
    await screen.findByText('First case');
    expect(document.querySelector('[data-slot="popover-content"]')).toBe(panel);
  });

  it('clears a group through its icon while retaining search and selection', async () => {
    const client = clientFixture();
    const onProjectChange = vi.fn();
    render(
      <ProjectSelector
        client={client}
        xpertId="assistant"
        activeProjectId="case-1"
        onProjectChange={onProjectChange}
      />,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Select project' }),
    );
    fireEvent.change(screen.getByPlaceholderText('Search projects'), {
      target: { value: 'case' },
    });
    await screen.findByRole('region', { name: 'Operations / Case' });
    fireEvent.click(
      within(
        screen.getByRole('region', { name: 'Operations / Case' }),
      ).getByRole('button', { name: 'Filter by type' }),
    );
    await waitFor(() =>
      expect(client.projects.list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          applicationKey: 'operations',
          projectTypeKey: 'case',
        }),
      ),
    );
    const clear = within(
      screen.getByRole('region', { name: 'Operations / Case' }),
    ).getByRole('button', { name: 'Clear type filter' });
    expect(clear.textContent).toBe('');
    expect(clear).toHaveAttribute('data-filter-active', 'true');
    expect(screen.queryByText('Clear type filter')).not.toBeInTheDocument();
    fireEvent.click(clear);
    await waitFor(() =>
      expect(
        vi.mocked(client.projects.list).mock.lastCall?.[0].applicationKey,
      ).toBeUndefined(),
    );
    expect(screen.getByPlaceholderText('Search projects')).toHaveValue('case');
    expect(onProjectChange).not.toHaveBeenCalled();
    expect(client.projects.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'case', skip: 0 }),
    );
  });

  it('allows clearing filters from the recent view even when there are no results', async () => {
    const client = clientFixture();
    await open(client);
    vi.mocked(client.projects.list).mockResolvedValueOnce({
      items: [],
      total: 0,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Operations / Case' }));
    await screen.findByText('No projects available');
    fireEvent.click(screen.getByRole('button', { name: 'Recently updated' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear type filter' }));
    await screen.findByText('First case');
    expect(
      screen.getByRole('button', { name: 'Filter application and type' }),
    ).toBeInTheDocument();
  });

  it('retains the old layout after a failed refresh and re-enables rows only after retry', async () => {
    const client = clientFixture();
    await open(client);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(client.projects.list).mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Operations / Case' }));
    await screen.findByText('Failed to load projects');
    expect(screen.getByRole('button', { name: 'First case' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'First case' })).toBeEnabled(),
    );
    warn.mockRestore();
  });

  it('discards retained rows when the Assistant scope changes', async () => {
    const client = clientFixture(false);
    const { rerender } = render(
      <ProjectSelector
        client={client}
        xpertId="assistant"
        onProjectCreate={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Select project' }));
    await screen.findByText('First case');
    const page = deferredPage();
    vi.mocked(client.projects.list).mockReturnValueOnce(page.promise);
    rerender(
      <ProjectSelector
        client={client}
        xpertId="another-assistant"
        onProjectCreate={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.queryByText('First case')).not.toBeInTheDocument(),
    );
    await act(async () => page.resolve({ items: [], total: 0 }));
  });

  it('holds the loaded viewport height across view and empty-state changes', () => {
    const measurement = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(0, 0, 320, 180));
    const { rerender, unmount } = render(
      <ProjectListViewport ready busy={false}>
        Grouped rows
      </ProjectListViewport>,
    );
    const viewport = document.querySelector(
      '[data-slot="composer-project-list-viewport"]',
    );
    expect(viewport).toHaveStyle({ height: '180px', flexBasis: '180px' });
    measurement.mockReturnValue(new DOMRect(0, 0, 320, 96));
    rerender(
      <ProjectListViewport
        ready
        busy={false}
        footer={<button>Load more</button>}
      >
        No projects available
      </ProjectListViewport>,
    );
    expect(
      document.querySelector('[data-slot="composer-project-list-viewport"]'),
    ).toBe(viewport);
    expect(viewport).toHaveStyle({ height: '180px', flexBasis: '180px' });
    expect(viewport).toContainElement(
      screen.getByRole('button', { name: 'Load more' }),
    );
    unmount();
    render(
      <ProjectListViewport ready busy={false}>
        Recent rows
      </ProjectListViewport>,
    );
    expect(
      document.querySelector('[data-slot="composer-project-list-viewport"]'),
    ).toHaveStyle({ height: '96px', flexBasis: '96px' });
    measurement.mockRestore();
  });
});
