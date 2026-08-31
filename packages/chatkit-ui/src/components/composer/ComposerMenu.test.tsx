import { fireEvent, render, screen } from '@testing-library/react';
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

  it('uses compact padding for the composer menu and its items', () => {
    render(<ComposerMenu goalCommandAvailable />);
    openMenu();

    const primaryPanel = document.querySelector(
      '[data-slot="composer-primary-panel"]',
    );
    expect(primaryPanel).toHaveClass('p-1');
    expect(primaryPanel).not.toHaveClass('p-3');
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

  it('opens goals as a side-by-side secondary panel and preserves goal and plan controls', () => {
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
      'w-[37rem]',
      'max-w-(--radix-dropdown-menu-content-available-width)',
      'overflow-visible',
      'p-1',
    );
    expect(menuContent).not.toHaveClass('w-[46.5rem]');
    expect(menuContent).not.toHaveClass('overflow-x-auto');
    expect(menuContent?.firstElementChild).toHaveClass(
      'flex',
      'w-full',
      'min-w-0',
    );
    expect(
      document.querySelector('[data-slot="composer-primary-panel"]'),
    ).toHaveClass('shrink-0', 'max-w-full', 'overflow-hidden');
    expect(secondaryPanel).toHaveClass('min-w-0', 'flex-1', 'overflow-hidden');
    expect(secondaryScroll).toHaveClass(
      'w-full',
      'min-w-0',
      'overflow-x-auto',
      'overflow-y-hidden',
    );
    expect(secondaryScroll?.firstElementChild).toHaveClass(
      'w-full',
      'min-w-80',
    );
    expect(secondaryScroll?.firstElementChild).not.toHaveClass('min-w-[30rem]');
    expect(secondaryPanel).not.toHaveClass(
      'absolute',
      'left-[calc(100%+0.5rem)]',
    );

    const goal = screen.getByRole('switch', { name: 'Goal' });
    const plan = screen.getByRole('switch', { name: 'Plan mode' });
    fireEvent.click(goal);
    fireEvent.click(plan);
    expect(onGoalPanelOpenChange).toHaveBeenCalledWith(true);
    expect(onPlanModeChange).toHaveBeenCalledWith(true);
    expect(
      screen.getByRole('button', { name: 'Close menu' }),
    ).toBeInTheDocument();
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
    ).toHaveClass('w-full', 'overflow-x-auto');
    expect(
      document.querySelector('[data-slot="composer-secondary-panel"]'),
    ).toHaveClass('min-w-0', 'flex-1', 'overflow-hidden');
    expect(
      document.querySelector('[data-slot="composer-secondary-scroll"]')
        ?.firstElementChild,
    ).toHaveClass('w-full', 'min-w-80');
    expect(
      document.querySelector('[data-slot="composer-secondary-scroll"]')
        ?.firstElementChild,
    ).not.toHaveClass('min-w-[30rem]');
  });

  it('shows runtime sub-agents under Experts', () => {
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
              description: 'Research helper',
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
    fireEvent.click(
      screen.getByRole('menuitemcheckbox', { name: /Researcher/ }),
    );
    expect(onRuntimeCapabilityToggle).toHaveBeenCalledWith(
      'subAgent',
      'researcher',
      true,
    );
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
