import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ComposerMenu } from './ComposerMenu';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'composer.openMenu': 'Open menu',
        'composer.addAttachment': 'Add attachment',
        'composer.planMode': 'Plan mode',
        'composer.capabilities.skills': 'Skills',
        'composer.capabilities.plugins': 'Plugins',
        'composer.capabilities.subAgents': 'Sub-agents',
        'composer.capabilities.agent': 'Agent',
        'composer.capabilities.xpertAgent': 'Xpert',
        'composer.capabilities.agentDetails': 'Agent details',
        'composer.capabilities.type': 'Type',
        'composer.capabilities.identifier': 'ID',
        'composer.capabilities.inputs': 'Inputs',
        'composer.capabilities.tools': 'Tools',
        'composer.capabilities.toolsets': 'Toolsets',
        'composer.capabilities.knowledge': 'Knowledge',
        'composer.planModeActive': 'Plan',
        'composer.disablePlanMode': 'Turn off plan mode',
      };
      return labels[key] ?? key;
    },
  }),
}));

vi.mock('../../providers/Theme', () => ({
  useTheme: () => ({
    theme: {
      radius: 'soft',
    },
  }),
}));

describe('ComposerMenu', () => {
  function openMenu() {
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter', code: 'Enter' });
  }

  it('renders plan mode even without attachments or tools', () => {
    const onPlanModeChange = vi.fn();

    render(
      <ComposerMenu
        planModeEnabled={false}
        onPlanModeChange={onPlanModeChange}
      />,
    );

    openMenu();

    const planMode = screen.getByRole('switch', { name: 'Plan mode' });
    expect(planMode).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(planMode);
    expect(onPlanModeChange).toHaveBeenCalledWith(true);
  });

  it('renders an active plan mode indicator that disables plan mode', () => {
    const onPlanModeChange = vi.fn();

    render(
      <ComposerMenu planModeEnabled onPlanModeChange={onPlanModeChange} />,
    );

    const activePlanMode = screen.getByRole('button', {
      name: 'Turn off plan mode',
    });
    expect(activePlanMode).toHaveTextContent('Plan');
    expect(
      activePlanMode.querySelector('[data-slot="plan-mode-indicator-icon"]'),
    ).toBeInTheDocument();
    expect(
      activePlanMode.querySelector('[data-slot="plan-mode-remove-icon"]'),
    ).toHaveClass('opacity-0', 'group-hover:opacity-100');

    fireEvent.click(activePlanMode);
    expect(onPlanModeChange).toHaveBeenCalledWith(false);
    expect(
      screen.getByRole('button', { name: 'Turn off plan mode' }),
    ).toHaveClass('h-8', 'text-xs');
  });

  it('keeps attachments and tools behavior alongside plan mode', () => {
    const onAttachmentClick = vi.fn();
    const onToolSelect = vi.fn();

    render(
      <ComposerMenu
        composer={{
          attachments: {
            enabled: true,
          },
          tools: [
            {
              id: 'search',
              label: 'Search',
              icon: 'search',
            },
          ],
        }}
        planModeEnabled
        onAttachmentClick={onAttachmentClick}
        onToolSelect={onToolSelect}
      />,
    );

    openMenu();

    expect(screen.getByRole('switch', { name: 'Plan mode' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    fireEvent.click(screen.getByRole('menuitem', { name: 'Add attachment' }));
    expect(onAttachmentClick).toHaveBeenCalledTimes(1);

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Search' }));
    expect(onToolSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'search',
      }),
    );
  });

  it('renders skills and plugins as drilldown panels', async () => {
    const onRuntimeCapabilityToggle = vi.fn();

    render(
      <ComposerMenu
        runtimeCapabilities={{
          skills: [
            {
              id: 'skill-1',
              workspaceId: 'workspace-1',
              label: 'Research Skill',
              description: 'Search and summarize',
              meta: {
                icon: {
                  type: 'svg',
                  value:
                    '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" /></svg>',
                },
              },
            },
          ],
          plugins: [
            {
              nodeKey: 'middleware-1',
              provider: 'sandbox',
              label: 'Sandbox Plugin',
              description: 'Run commands',
              meta: {
                icon: {
                  type: 'svg',
                  value:
                    '<svg viewBox="0 0 16 16"><path d="M2 2h12v12H2z" /></svg>',
                },
              },
            },
          ],
          subAgents: [
            {
              nodeKey: 'researcher',
              type: 'agent',
              label: 'Researcher',
              name: 'researcher',
              description: 'Research helper',
              avatar: {
                background: '#123456',
              },
              parameters: [{ name: 'topic', title: 'Topic' }],
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

    expect(
      screen.getByRole('menuitem', { name: 'Skills' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Plugins' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Sub-agents' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemcheckbox', { name: /Research Skill/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Skills' }));
    const skillItem = await screen.findByRole('menuitemcheckbox', {
      name: /Research Skill/,
    });
    expect(
      skillItem.querySelector('[data-slot="runtime-capability-meta-icon"] svg'),
    ).toBeInTheDocument();
    fireEvent.click(skillItem);
    expect(onRuntimeCapabilityToggle).toHaveBeenCalledWith(
      'skill',
      'skill-1',
      true,
    );

    fireEvent.click(screen.getByRole('menuitem', { name: 'Skills' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Plugins' }));
    const pluginItem = await screen.findByRole('menuitemcheckbox', {
      name: /Sandbox Plugin/,
    });
    expect(
      pluginItem.querySelector(
        '[data-slot="runtime-capability-meta-icon"] svg',
      ),
    ).toBeInTheDocument();
    fireEvent.click(pluginItem);
    expect(onRuntimeCapabilityToggle).toHaveBeenCalledWith(
      'plugin',
      'middleware-1',
      true,
    );

    fireEvent.click(screen.getByRole('menuitem', { name: 'Plugins' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sub-agents' }));
    const subAgentItem = await screen.findByRole('menuitemcheckbox', {
      name: /Researcher/,
    });
    expect(
      subAgentItem.querySelector('[data-slot="runtime-sub-agent-avatar"]'),
    ).toBeInTheDocument();
    fireEvent.click(subAgentItem);
    expect(onRuntimeCapabilityToggle).toHaveBeenCalledWith(
      'subAgent',
      'researcher',
      true,
    );
    expect(
      document.querySelector('[data-slot="runtime-sub-agent-detail-card"]'),
    ).not.toBeInTheDocument();
    fireEvent.pointerMove(
      screen.getByRole('button', { name: 'Agent details' }),
    );
    await waitFor(() => {
      const detailCard = document.querySelector(
        '[data-slot="runtime-sub-agent-detail-card"]',
      );
      expect(detailCard).toBeInTheDocument();
      expect(
        within(detailCard as HTMLElement).getByText('Search Tools'),
      ).toBeInTheDocument();
    });
  });
});
