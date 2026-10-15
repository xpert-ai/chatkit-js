import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResourceComponentInfo } from './ResourceComponentInfo';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({ t: (key: string) => key }),
}));
afterEach(cleanup);

describe('template component presentation', () => {
  it('shows the sub-agent type, title, description and readiness', () => {
    render(
      <ResourceComponentInfo
        component={{
          kind: 'assistant_template',
          key: 'reviewer',
          title: 'Case reviewer',
          description: 'Review the supplied evidence',
          status: 'ready',
        }}
      />,
    );
    expect(
      screen.getByText(/composer.resources.assistant_template/),
    ).toHaveTextContent('Case reviewer');
    expect(screen.getByText(/composer.resources.ready/)).toBeInTheDocument();
    expect(
      screen.getByText('Review the supplied evidence'),
    ).toBeInTheDocument();
  });

  it('preserves the existing component fallback', () => {
    render(
      <ResourceComponentInfo
        component={{ kind: 'mcp', key: 'calendar', status: 'requires_auth' }}
      />,
    );
    expect(screen.getByText(/calendar/)).toHaveTextContent(
      'composer.resources.requires_auth',
    );
    expect(screen.queryByText(/assistant_template/)).not.toBeInTheDocument();
  });
});
