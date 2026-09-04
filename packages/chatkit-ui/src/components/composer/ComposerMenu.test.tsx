import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ComposerMenu } from './ComposerMenu';

const themeMock = vi.hoisted(() => ({
  radius: 'soft' as 'pill' | 'round' | 'soft' | 'sharp',
}));

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    i18n: { language: 'en-US' },
    t: (key: string, options?: { project?: string }) => {
      const labels: Record<string, string> = {
        'composer.openMenu': 'Open menu',
        'composer.closeMenu': 'Close menu',
        'composer.addAttachment': 'Add attachment',
        'composer.planMode': 'Plan mode',
        'composer.planModeActive': 'Plan',
        'composer.disablePlanMode': 'Turn off plan mode',
        'composer.capabilities.skills': 'Skills',
        'composer.capabilities.agent': 'Agent',
        'composer.capabilities.xpertAgent': 'Xpert',
        'composer.capabilities.agentDetails': 'Agent details',
        'composer.capabilities.type': 'Type',
        'composer.capabilities.identifier': 'ID',
        'composer.capabilities.tools': 'Tools',
        'composer.capabilities.toolsets': 'Toolsets',
        'composer.capabilities.knowledge': 'Knowledge',
        'composer.workbuddy.targets': 'Goals',
        'composer.workbuddy.experts': 'Experts',
        'composer.workbuddy.connectors': 'Connectors',
        'composer.workbuddy.searchSkills': 'Search skills',
        'composer.workbuddy.searchExperts': 'Search experts',
        'composer.workbuddy.emptySkills': 'No matching skills',
        'composer.workbuddy.emptyExperts': 'No matching experts',
        'composer.workbuddy.expertSkills': 'Expert skills',
        'composer.workbuddy.projectSkills': `${options?.project ?? ''} project skills`,
        'chat.goal.label': 'Goal',
        'chat.goal.hide': 'Hide goal',
      };
      return labels[key] ?? key;
    },
  }),
}));

vi.mock('../../providers/Theme', () => ({
  useTheme: () => ({ theme: { radius: themeMock.radius } }),
}));

describe('ComposerMenu', () => {
  beforeEach(() => {
    themeMock.radius = 'soft';
  });

  function openMenu() {
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter', code: 'Enter' });
  }

  it('smoothly rotates the standalone plus into a circular close control', () => {
    render(<ComposerMenu />);

    const trigger = screen.getByRole('button', { name: 'Open menu' });
    expect(trigger.querySelector('.lucide-plus')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter', code: 'Enter' });

    const closeTrigger = screen.getByRole('button', { name: 'Close menu' });
    expect(closeTrigger.querySelector('.lucide-plus')).toHaveClass(
      'rotate-45',
      'duration-300',
    );
    expect(closeTrigger.querySelector('.lucide-x')).not.toBeInTheDocument();
    expect(closeTrigger).toHaveClass('rounded-full', 'bg-muted');
    expect(closeTrigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(
      screen.getByRole('button', { name: 'Open menu' }),
    ).toBeInTheDocument();
  });

  it('renders the five fixed WorkBuddy primary actions', () => {
    render(<ComposerMenu connectorsEnabled />);
    openMenu();

    const labels = [
      'Add attachment',
      'Goals',
      'Experts',
      'Skills',
      'Connectors',
    ];
    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent),
    ).toEqual(labels);
    for (const label of labels) {
      expect(screen.getByRole('menuitem', { name: label })).toHaveClass(
        'font-normal',
      );
    }
    expect(screen.queryByText('Plugins')).not.toBeInTheDocument();
  });

  it('uses the legacy panel border and gutter with compact item padding', () => {
    render(<ComposerMenu goalCommandAvailable />);
    openMenu();

    const menuContent = document.querySelector(
      '[data-slot="dropdown-menu-content"]',
    );
    const primaryPanel = document.querySelector(
      '[data-slot="composer-primary-panel"]',
    );
    expect(menuContent).toHaveClass('p-1');
    expect(primaryPanel).toHaveClass('p-1', 'ring-1', 'ring-foreground/10');
    expect(primaryPanel).not.toHaveClass('p-0', 'p-3', 'ring-0');
    expect(
      primaryPanel?.querySelector('[data-slot="dropdown-menu-separator"]'),
    ).toHaveClass('my-2');
    for (const item of screen.getAllByRole('menuitem')) {
      expect(item).toHaveClass('p-1.5');
    }

    fireEvent.click(screen.getByRole('menuitem', { name: 'Goals' }));
    const targetItems = screen.getAllByRole('switch');
    expect(targetItems[0]?.parentElement).toHaveClass('p-1');
    for (const item of targetItems) {
      expect(item).toHaveClass('p-1.5');
    }
  });

  it('keeps theme panel radius while using a circular expanded close button', () => {
    themeMock.radius = 'pill';
    render(<ComposerMenu />);
    openMenu();

    expect(
      document.querySelector('[data-slot="composer-primary-panel"]'),
    ).toHaveClass('rounded-3xl');
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveClass(
      'rounded-full',
    );
  });

  it('opens goals in place, returns to the primary menu, and preserves its controls', () => {
    const onGoalPanelOpenChange = vi.fn();
    const onPlanModeChange = vi.fn();
    render(
      <ComposerMenu
        goalCommandAvailable
        onGoalPanelOpenChange={onGoalPanelOpenChange}
        onPlanModeChange={onPlanModeChange}
      />,
    );
    openMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Goals' }));
    const menuContent = document.querySelector(
      '[data-slot="dropdown-menu-content"]',
    );
    const secondaryPanel = document.querySelector(
      '[data-slot="composer-secondary-panel"]',
    );
    const secondaryScroll = document.querySelector(
      '[data-slot="composer-secondary-scroll"]',
    );
    expect(menuContent).toHaveClass(
      'w-[16.5rem]',
      'max-w-(--radix-dropdown-menu-content-available-width)',
      'overflow-hidden',
      'p-1',
    );
    expect(
      document.querySelector('[data-slot="composer-primary-panel"]'),
    ).not.toBeInTheDocument();
    expect(secondaryPanel).toHaveClass(
      'w-64',
      'max-w-full',
      'overflow-hidden',
      'ring-1',
      'ring-foreground/10',
    );
    expect(secondaryPanel).not.toHaveClass('ring-0');
    expect(secondaryScroll).toHaveClass(
      'w-full',
      'min-w-0',
      'overflow-x-hidden',
    );
    expect(secondaryScroll?.firstElementChild).toHaveClass('w-full', 'min-w-0');

    const goal = screen.getByRole('switch', { name: 'Goal' });
    const plan = screen.getByRole('switch', { name: 'Plan mode' });
    fireEvent.click(goal);
    fireEvent.click(plan);
    expect(onGoalPanelOpenChange).toHaveBeenCalledWith(true);
    expect(onPlanModeChange).toHaveBeenCalledWith(true);
    expect(
      screen.getByRole('button', { name: 'Close menu' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Goals' }));
    expect(
      document.querySelector('[data-slot="composer-primary-panel"]'),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="composer-secondary-panel"]'),
    ).not.toBeInTheDocument();
  });

  it('searches and selects skills in the secondary panel', () => {
    const onRuntimeCapabilityToggle = vi.fn();
    render(
      <ComposerMenu
        runtimeCapabilities={{
          skills: [
            {
              id: 'research',
              workspaceId: 'workspace-1',
              label: 'Research Skill',
              description: 'Search and summarize',
            },
            {
              id: 'writer',
              workspaceId: 'workspace-1',
              label: 'Writer Skill',
              description: 'Write copy',
            },
          ],
          plugins: [
            {
              nodeKey: 'legacy-plugin',
              provider: 'legacy',
              label: 'Legacy Plugin',
            },
          ],
          subAgents: [],
        }}
        selectedRuntimeCapabilities={{
          mode: 'allowlist',
          skills: { workspaceId: 'workspace-1', ids: [] },
          plugins: { nodeKeys: [] },
          subAgents: { nodeKeys: [] },
        }}
        onRuntimeCapabilityToggle={onRuntimeCapabilityToggle}
      />,
    );
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Skills/ }));

    expect(
      screen
        .getByRole('menuitem', { name: 'Skills' })
        .querySelector('.lucide-arrow-left'),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="composer-primary-panel"]'),
    ).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search skills')).toHaveClass('h-8');
    expect(
      document.querySelector('[data-slot="composer-capability-list"]'),
    ).not.toHaveClass('pr-3');

    fireEvent.change(screen.getByPlaceholderText('Search skills'), {
      target: { value: 'research' },
    });
    expect(
      screen.getByRole('menuitemcheckbox', { name: /Research Skill/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Writer Skill')).not.toBeInTheDocument();
    expect(screen.queryByText('Legacy Plugin')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('menuitemcheckbox', { name: /Research Skill/ }),
    );
    expect(onRuntimeCapabilityToggle).toHaveBeenCalledWith(
      'skill',
      'research',
      true,
    );
  });

  it('keeps the gap above search smaller than its horizontal inset', () => {
    render(
      <ComposerMenu
        runtimeCapabilities={{ skills: [], plugins: [], subAgents: [] }}
      />,
    );
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Skills/ }));

    const secondaryPanel = document.querySelector(
      '[data-slot="composer-secondary-panel"]',
    );
    expect(
      secondaryPanel?.querySelector('[data-slot="dropdown-menu-separator"]'),
    ).toHaveClass('my-0');

    const panelSearch = document.querySelector(
      '[data-slot="composer-panel-search"]',
    );
    expect(panelSearch).not.toBeNull();
    expect(panelSearch).toHaveClass('px-2', 'pt-1', 'pb-2');
    expect(panelSearch).not.toHaveClass('p-2', 'pt-2');
  });

  it('groups same-name Xpert and Project skills without overwriting either source', () => {
    render(
      <ComposerMenu
        runtimeCapabilities={{
          skills: [
            {
              id: 'runtime-skill/v1/xpert/xpert-1/docx-editor',
              workspaceId: 'workspace-1',
              label: 'docx-editor',
              description: 'Edit DOCX files',
              meta: {
                skillSource: {
                  type: 'xpert',
                  ownerId: 'xpert-1',
                  label: 'DOCX assistant',
                  skillId: 'docx-editor',
                },
              },
            },
            {
              id: 'runtime-skill/v1/project/project-1/docx-editor',
              workspaceId: 'project:project-1',
              label: 'docx-editor',
              description: 'Project DOCX rules',
              meta: {
                skillSource: {
                  type: 'project',
                  ownerId: 'project-1',
                  label: 'Workbench 1',
                  skillId: 'docx-editor',
                },
              },
            },
          ],
          plugins: [],
          subAgents: [],
        }}
        selectedRuntimeCapabilities={{
          mode: 'allowlist',
          skills: {
            workspaceId: 'workspace-1',
            ids: [
              'runtime-skill/v1/xpert/xpert-1/docx-editor',
              'runtime-skill/v1/project/project-1/docx-editor',
            ],
          },
          plugins: { nodeKeys: [] },
          subAgents: { nodeKeys: [] },
        }}
      />,
    );
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Skills/ }));

    expect(screen.getByText('Expert skills')).toBeInTheDocument();
    expect(screen.getByText('Workbench 1 project skills')).toBeInTheDocument();
    expect(screen.getByText('Expert skills')).toHaveClass('font-normal');
    expect(screen.getByText('Workbench 1 project skills')).toHaveClass(
      'font-normal',
    );
    expect(
      screen.getAllByRole('menuitemcheckbox', { name: /docx-editor/ }),
    ).toHaveLength(2);
  });

  it('vertically centers skills that have no description', () => {
    render(
      <ComposerMenu
        runtimeCapabilities={{
          skills: [
            {
              id: 'no-description',
              workspaceId: 'workspace-1',
              label: 'No description',
            },
            {
              id: 'with-description',
              workspaceId: 'workspace-1',
              label: 'With description',
              description: 'Helpful details',
            },
          ],
          plugins: [],
          subAgents: [],
        }}
      />,
    );
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Skills/ }));

    expect(
      screen.getByRole('menuitemcheckbox', { name: 'No description' }),
    ).toHaveClass('items-center');
    expect(
      screen.getByRole('menuitemcheckbox', { name: /With description/ }),
    ).toHaveClass('items-start');
  });

  it('uses the correct empty copy for the Experts panel', () => {
    render(
      <ComposerMenu
        runtimeCapabilities={{ skills: [], plugins: [], subAgents: [] }}
      />,
    );
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Experts' }));

    expect(screen.getByPlaceholderText('Search experts')).toHaveClass('h-8');
    expect(screen.getByText('No matching experts')).toBeInTheDocument();
  });

  it('keeps the Connector content responsive inside the secondary scroller', () => {
    render(<ComposerMenu connectorsEnabled />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Connectors' }));

    expect(
      document.querySelector('[data-slot="composer-connector-panel"]'),
    ).toHaveClass('w-full', 'min-w-0', 'max-w-full');
    expect(
      document.querySelector('[data-slot="composer-connector-panel"]'),
    ).not.toHaveClass(
      'h-[30rem]',
      'max-h-[70vh]',
      'w-[30rem]',
      'max-w-[calc(100vw-1rem)]',
    );
    expect(
      document.querySelector('[data-slot="composer-secondary-scroll"]'),
    ).toHaveClass('w-full', 'min-w-0', 'overflow-x-hidden');
    expect(
      document.querySelector('[data-slot="composer-secondary-panel"]'),
    ).toHaveClass('w-64', 'min-w-0', 'max-w-full', 'overflow-hidden');
    expect(
      document.querySelector('[data-slot="composer-secondary-scroll"]')
        ?.firstElementChild,
    ).toHaveClass('w-full', 'min-w-0');
    expect(
      document.querySelector('[data-slot="composer-secondary-scroll"]')
        ?.firstElementChild,
    ).not.toHaveClass('min-w-80', 'min-w-[30rem]');
  });

  it('shows runtime sub-agents and their hover details under Experts', async () => {
    const onRuntimeCapabilityToggle = vi.fn();
    render(
      <ComposerMenu
        runtimeCapabilities={{
          skills: [],
          plugins: [],
          subAgents: [
            {
              nodeKey: 'researcher',
              type: 'agent',
              label: 'Researcher',
              name: 'researcher',
              description: 'Research helper',
              avatar: { background: '#123456' },
              agentKey: 'agent-researcher',
              toolNames: ['search'],
              toolsetNames: ['Search Tools'],
              knowledgebaseNames: ['Docs'],
            },
          ],
        }}
        selectedRuntimeCapabilities={{
          mode: 'allowlist',
          skills: { workspaceId: 'workspace-1', ids: [] },
          plugins: { nodeKeys: [] },
          subAgents: { nodeKeys: [] },
        }}
        onRuntimeCapabilityToggle={onRuntimeCapabilityToggle}
      />,
    );
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Experts' }));
    const detailTrigger = screen.getByRole('button', {
      name: 'Agent details',
    });
    expect(
      document.querySelector('[data-slot="runtime-sub-agent-detail-card"]'),
    ).not.toBeInTheDocument();

    fireEvent.pointerMove(detailTrigger);
    await waitFor(() => {
      const detailCard = document.querySelector(
        '[data-slot="runtime-sub-agent-detail-card"]',
      );
      expect(detailCard).toBeInTheDocument();
      expect(
        within(detailCard as HTMLElement).getByText('agent-researcher'),
      ).toBeInTheDocument();
      expect(
        within(detailCard as HTMLElement).getByText('Search Tools'),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('menuitemcheckbox', { name: /Researcher/ }),
    );
    expect(onRuntimeCapabilityToggle).toHaveBeenCalledWith(
      'subAgent',
      'researcher',
      true,
    );
  });

  it('lets short capability lists size to their content and scrolls long lists', () => {
    render(
      <ComposerMenu
        runtimeCapabilities={{
          skills: [],
          plugins: [],
          subAgents: [
            {
              nodeKey: 'researcher',
              type: 'agent',
              label: 'Researcher',
              description: 'Research helper',
            },
          ],
        }}
      />,
    );
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Experts' }));

    const capabilityScroll = document.querySelector(
      '[data-slot="composer-capability-scroll"]',
    );
    expect(capabilityScroll).not.toBeNull();
    expect(capabilityScroll).toHaveClass('max-h-72', 'overflow-y-auto');
    expect(capabilityScroll).not.toHaveClass('h-72');
  });

  it('renders active target controls outside the dropdown', () => {
    const onPlanModeChange = vi.fn();
    const onGoalPanelOpenChange = vi.fn();
    render(
      <ComposerMenu
        planModeEnabled
        goalCommandAvailable
        goalPanelOpen
        onPlanModeChange={onPlanModeChange}
        onGoalPanelOpenChange={onGoalPanelOpenChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Turn off plan mode' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hide goal' }));
    expect(onPlanModeChange).toHaveBeenCalledWith(false);
    expect(onGoalPanelOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not reserve close-icon space in inactive plan and goal indicators', () => {
    render(<ComposerMenu planModeEnabled goalCommandAvailable goalPanelOpen />);

    for (const name of ['Turn off plan mode', 'Hide goal']) {
      const indicator = screen.getByRole('button', { name });
      const closeIcon = indicator.querySelector('.lucide-x');

      expect(indicator).not.toHaveClass('gap-1.5');
      expect(closeIcon).toHaveClass(
        'ml-0',
        'w-0',
        'opacity-0',
        'group-hover/indicator:ml-1',
        'group-hover/indicator:w-3.5',
        'group-hover/indicator:opacity-100',
        'group-focus-visible/indicator:ml-1',
        'group-focus-visible/indicator:w-3.5',
        'group-focus-visible/indicator:opacity-100',
      );
    }
  });
});
