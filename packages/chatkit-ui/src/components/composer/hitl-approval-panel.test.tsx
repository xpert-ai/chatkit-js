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
        'composer.hitl.mcpElicitationTitle': 'MCP Elicitation',
        'composer.hitl.fieldProgress': `Field ${values?.current}/${values?.total}`,
        'composer.hitl.requiredUnanswered': '1 required unanswered',
        'composer.hitl.requiredAnswered': 'All required fields answered',
        'composer.hitl.true': 'True',
        'composer.hitl.false': 'False',
        'composer.hitl.cancel': 'Cancel',
        'composer.hitl.elicitationSubmit': 'Submit',
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

function createMcpElicitationRequest(): PendingHITLRequest {
  return createRequest({
    elicitation: {
      kind: 'mcp_elicitation',
      actionName: 'MCP Elicitation',
      field: {
        name: 'approved',
        type: 'boolean',
        title: 'Approve',
        required: true,
      },
    },
    actionRequests: [
      {
        name: 'MCP Elicitation',
        args: { approved: false },
        description: 'Approve OAuth MCP tool test',
      },
    ],
    reviewConfigs: [
      {
        actionName: 'MCP Elicitation',
        allowedDecisions: ['approve', 'reject'],
      },
    ],
  });
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

  it('renders MCP boolean elicitation as a required True or False field', () => {
    const onSubmit = vi.fn();
    const request = createMcpElicitationRequest();

    render(<HITLApprovalPanel request={request} onSubmit={onSubmit} />);

    expect(screen.getByLabelText('MCP Elicitation')).toBeInTheDocument();
    expect(screen.getByText('Field 1/1')).toBeInTheDocument();
    expect(screen.getByText('1 required unanswered')).toBeInTheDocument();
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Approve OAuth MCP tool test')).toBeInTheDocument();
    expect(screen.queryByText('Arguments')).not.toBeInTheDocument();
    expect(screen.queryByText('approved:')).not.toBeInTheDocument();

    const submit = screen.getByRole('button', { name: 'Submit' });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'True' }));
    expect(
      screen.getByText('All required fields answered'),
    ).toBeInTheDocument();
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    expect(onSubmit).toHaveBeenCalledWith([{ type: 'approve' }]);
  });

  it('submits False as the boolean rejection decision', () => {
    const onSubmit = vi.fn();
    render(
      <HITLApprovalPanel
        request={createMcpElicitationRequest()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'False' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).toHaveBeenCalledWith([{ type: 'reject' }]);
  });

  it('falls back to action review and submits every decision for tagged multi-action requests', () => {
    const onSubmit = vi.fn();
    const request = createMcpElicitationRequest();
    request.request.actionRequests.push({
      name: 'send_follow_up',
      args: { recipient: 'user@example.com' },
    });
    request.request.reviewConfigs.push({
      actionName: 'send_follow_up',
      allowedDecisions: ['approve', 'reject'],
    });

    render(<HITLApprovalPanel request={request} onSubmit={onSubmit} />);

    expect(screen.getByLabelText('Action review')).toBeInTheDocument();
    expect(screen.queryByLabelText('MCP Elicitation')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(onSubmit).toHaveBeenCalledWith([
      { type: 'approve' },
      { type: 'approve' },
    ]);
  });

  it('does not infer MCP elicitation from the action display name', () => {
    render(
      <HITLApprovalPanel
        request={createRequest({
          actionRequests: [
            {
              name: 'MCP Elicitation',
              args: { approved: false },
            },
          ],
          reviewConfigs: [
            {
              actionName: 'MCP Elicitation',
              allowedDecisions: ['approve', 'reject'],
            },
          ],
        })}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Action review')).toBeInTheDocument();
    expect(screen.getByText('Arguments')).toBeInTheDocument();
    expect(
      screen.queryByRole('radio', { name: 'True' }),
    ).not.toBeInTheDocument();
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
