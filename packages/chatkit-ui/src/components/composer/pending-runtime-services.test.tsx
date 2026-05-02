import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createDefaultRuntimeActivitiesState } from '../../lib/runtime-activity';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string, values?: Record<string, number>) => {
      if (key === 'chat.runtimeServices.summary') {
        return `${values?.count} services running`;
      }

      if (key === 'chat.runtimeServices.stop') {
        return 'Stop service';
      }

      return key;
    },
  }),
}));

vi.mock('../../providers/Theme', () => ({
  useTheme: () => ({
    theme: {
      radius: 'soft',
    },
    isDarkMode: false,
  }),
}));

import { PendingRuntimeServices } from './pending-runtime-services';

function createState() {
  return {
    ...createDefaultRuntimeActivitiesState().sandboxServices,
    services: [
      {
        id: 'service-1',
        conversationId: 'conversation-1',
        provider: 'local-shell-sandbox',
        name: 'web',
        command: 'pnpm dev --host 0.0.0.0',
        workingDirectory: '/workspace/project',
        requestedPort: 3000,
        actualPort: 5173,
        status: 'running' as const,
        transportMode: 'http' as const,
      },
    ],
  };
}

describe('PendingRuntimeServices', () => {
  it('renders the services summary and service details', () => {
    render(
      <PendingRuntimeServices state={createState()} onStopService={vi.fn()} />,
    );

    expect(screen.getByText('1 services running')).toBeInTheDocument();
    expect(screen.getByText('web')).toBeInTheDocument();
    expect(screen.getByText('running / http / :5173')).toBeInTheDocument();
    expect(screen.getByText('pnpm dev --host 0.0.0.0')).toBeInTheDocument();
  });

  it('toggles the service list when the header is clicked', () => {
    render(
      <PendingRuntimeServices state={createState()} onStopService={vi.fn()} />,
    );

    const toggle = screen.getByRole('button', {
      name: /1 services running/i,
    });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('web')).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('web')).not.toBeInTheDocument();
  });

  it('calls the stop handler for a service', async () => {
    const onStopService = vi.fn().mockResolvedValue(undefined);

    render(
      <PendingRuntimeServices
        state={createState()}
        onStopService={onStopService}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Stop service' }));

    await waitFor(() => {
      expect(onStopService).toHaveBeenCalledWith('service-1');
    });
  });

  it('hides the panel when there are no active services to render', () => {
    const { container } = render(
      <PendingRuntimeServices
        state={createDefaultRuntimeActivitiesState().sandboxServices}
        onStopService={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
