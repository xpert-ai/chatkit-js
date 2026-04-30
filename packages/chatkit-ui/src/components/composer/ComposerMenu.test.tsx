import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ComposerMenu } from './ComposerMenu';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'composer.openMenu': 'Open menu',
        'composer.addAttachment': 'Add attachment',
        'composer.planMode': 'Plan mode',
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
  it('renders plan mode even without attachments or tools', () => {
    const onPlanModeChange = vi.fn();

    render(
      <ComposerMenu
        planModeEnabled={false}
        onPlanModeChange={onPlanModeChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

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

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    expect(
      screen.getByRole('switch', { name: 'Plan mode' }),
    ).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Add attachment' }));
    expect(onAttachmentClick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(onToolSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'search',
      }),
    );
  });
});
