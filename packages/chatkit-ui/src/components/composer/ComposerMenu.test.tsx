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
