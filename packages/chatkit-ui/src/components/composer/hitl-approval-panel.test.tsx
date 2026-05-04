import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PendingHITLRequest } from '../../lib/hitl';

const themeMock = vi.hoisted(() => ({
  theme: {
    radius: 'soft',
    density: 'normal',
  },
}));

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) => {
      const labels: Record<string, string> = {
        'composer.hitl.title': 'Action review',
        'composer.hitl.actionProgress': `${values?.current} of ${values?.total}`,
        'composer.hitl.previousAction': 'Previous action',
        'composer.hitl.nextAction': 'Next action',
        'composer.hitl.arguments': 'Arguments',
        'composer.hitl.approve': 'Approve',
        'composer.hitl.edit': 'Edit',
        'composer.hitl.reject': 'Reject',
        'composer.hitl.respond': 'Respond',
        'composer.hitl.rejectMessage': 'Feedback for the agent',
        'composer.hitl.respondMessage': 'Response to the agent',
        'composer.hitl.rejectPlaceholder':
          'Explain why this action should not run',
        'composer.hitl.respondPlaceholder':
          'Tell the agent what to do instead',
        'composer.hitl.invalidJson': 'Arguments must be a valid JSON object',
        'composer.hitl.responseRequired': 'A response message is required',
        'composer.hitl.dismiss': 'Dismiss',
        'composer.hitl.submit': 'Confirm',
      };
      return labels[key] ?? key;
    },
  }),
}));

vi.mock('../../providers/Theme', () => ({
  useTheme: () => ({
    theme: themeMock.theme,
    isDarkMode: false,
  }),
}));

import { HITLApprovalPanel } from './hitl-approval-panel';

function createRequest(
  overrides?: Partial<PendingHITLRequest['request']>,
): PendingHITLRequest {
  return {
    id: 'interrupt-1',
    interruptId: 'interrupt-1',
    taskId: 'task-1',
    createdAt: 1,
    request: {
      actionRequests: [
        {
          name: 'send_email',
          args: {
            to: 'user@example.com',
            subject: 'Hello',
          },
          description: 'Review this email before sending.',
        },
      ],
      reviewConfigs: [
        {
          actionName: 'send_email',
          allowedDecisions: ['approve', 'edit', 'reject'],
        },
      ],
      ...overrides,
    },
  };
}

describe('HITLApprovalPanel', () => {
  beforeEach(() => {
    themeMock.theme = {
      radius: 'soft',
      density: 'normal',
    };
  });

  it('renders an action request and submits approve by default', () => {
    const onSubmit = vi.fn();
    render(
      <HITLApprovalPanel request={createRequest()} onSubmit={onSubmit} />,
    );

    expect(screen.getByLabelText('Action review')).toBeInTheDocument();
    expect(screen.getByText('send_email')).toBeInTheDocument();
    expect(
      screen.getByText('Review this email before sending.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(onSubmit).toHaveBeenCalledWith([{ type: 'approve' }]);
  });

  it('renders readonly arguments as a JSON tree', () => {
    render(
      <HITLApprovalPanel request={createRequest()} onSubmit={vi.fn()} />,
    );

    expect(screen.getByText('Object(2)')).toBeInTheDocument();
    expect(screen.getByText('to:')).toBeInTheDocument();
    expect(screen.getByText('"user@example.com"')).toBeInTheDocument();
  });

  it.each([
    ['compact', 'h-6', 'h-7'],
    ['normal', 'h-7', 'h-8'],
    ['spacious', 'h-8', 'h-8'],
  ] as const)(
    'uses smaller HITL button sizing for %s density',
    (density, decisionHeight, submitHeight) => {
      themeMock.theme = {
        radius: 'soft',
        density,
      };

      render(
        <HITLApprovalPanel request={createRequest()} onSubmit={vi.fn()} />,
      );

      expect(screen.getByRole('button', { name: /approve/i })).toHaveClass(
        decisionHeight,
      );
      expect(screen.getByRole('button', { name: /confirm/i })).toHaveClass(
        submitHeight,
      );
    },
  );

  it('uses warning color for reject and clamps long descriptions', () => {
    render(
      <HITLApprovalPanel request={createRequest()} onSubmit={vi.fn()} />,
    );

    expect(screen.getByText('Review this email before sending.')).toHaveClass(
      '[-webkit-line-clamp:3]',
    );
    expect(screen.getByRole('button', { name: /reject/i })).toHaveClass(
      'text-destructive',
    );
  });

  it('submits edited action args', () => {
    const onSubmit = vi.fn();
    render(
      <HITLApprovalPanel request={createRequest()} onSubmit={onSubmit} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByLabelText(/arguments/i), {
      target: {
        value: JSON.stringify(
          {
            to: 'new@example.com',
            subject: 'Updated',
          },
          null,
          2,
        ),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(onSubmit).toHaveBeenCalledWith([
      {
        type: 'edit',
        editedAction: {
          name: 'send_email',
          args: {
            to: 'new@example.com',
            subject: 'Updated',
          },
        },
      },
    ]);
  });

  it('submits reject with reviewer feedback', () => {
    const onSubmit = vi.fn();
    render(
      <HITLApprovalPanel request={createRequest()} onSubmit={onSubmit} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /reject/i }));
    fireEvent.change(
      screen.getByPlaceholderText('Explain why this action should not run'),
      {
        target: { value: 'Recipient has not opted in.' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(onSubmit).toHaveBeenCalledWith([
      {
        type: 'reject',
        message: 'Recipient has not opted in.',
      },
    ]);
  });

  it('validates edited args as a JSON object', () => {
    const onSubmit = vi.fn();
    render(
      <HITLApprovalPanel request={createRequest()} onSubmit={onSubmit} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByLabelText(/arguments/i), {
      target: { value: '[1]' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText('Arguments must be a valid JSON object'),
    ).toBeInTheDocument();
  });

  it('renders nothing without a pending request', () => {
    const { container } = render(
      <HITLApprovalPanel request={null} onSubmit={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
