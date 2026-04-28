import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PendingRequestUserInput } from '../../providers/Stream';

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
        'composer.requestUserInput.title': 'Input requested',
        'composer.requestUserInput.recommended': 'Recommended',
        'composer.requestUserInput.other': 'Other',
        'composer.requestUserInput.otherPlaceholder': 'Type a custom answer',
        'composer.requestUserInput.continue': 'Continue',
        'composer.requestUserInput.dismiss': 'Dismiss',
        'composer.requestUserInput.previousQuestion': 'Previous question',
        'composer.requestUserInput.nextQuestion': 'Next question',
        'composer.requestUserInput.questionProgress': `${values?.current} of ${values?.total}`,
        'composer.requestUserInput.optionInfo': `Details for ${values?.label}`,
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

import { RequestUserInputPanel } from './request-user-input-panel';

function createRequest(
  questions: PendingRequestUserInput['params']['questions'],
): PendingRequestUserInput {
  return {
    id: 'call-1',
    toolCallId: 'call-1',
    createdAt: 1,
    params: {
      questions,
    },
  };
}

const scopeQuestion = {
  id: 'scope',
  header: 'Scope',
  question: 'Which scope should I use?',
  options: [
    {
      label: 'Minimal (Recommended)',
      description: 'Change only the requested surface.',
    },
    {
      label: 'Broad',
      description: 'Include adjacent cleanup.',
    },
  ],
};

describe('RequestUserInputPanel', () => {
  beforeEach(() => {
    themeMock.theme = {
      radius: 'soft',
      density: 'normal',
    };
  });

  it('renders one Codex-style question and submits a selected option click', () => {
    const onSubmit = vi.fn();
    render(
      <RequestUserInputPanel
        request={createRequest([scopeQuestion])}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText('Input requested')).toBeInTheDocument();
    expect(screen.getByText('Which scope should I use?')).toBeInTheDocument();
    expect(screen.getByText('Minimal')).toBeInTheDocument();
    expect(screen.getByText(/Recommended/)).toBeInTheDocument();
    expect(
      screen.queryByText('Change only the requested surface.'),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Details for Minimal')).toHaveAttribute(
      'title',
      'Change only the requested surface.',
    );

    const continueButton = screen.getByRole('button', { name: /continue/i });
    expect(continueButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /^1\. Minimal/i }));
    expect(onSubmit).toHaveBeenCalledWith([
      {
        id: 'scope',
        question: 'Which scope should I use?',
        type: 'option',
        value: 'Minimal (Recommended)',
        label: 'Minimal (Recommended)',
        description: 'Change only the requested surface.',
      },
    ]);
  });

  it('clicking an option advances to the next question and Other uses Continue', () => {
    const onSubmit = vi.fn();
    render(
      <RequestUserInputPanel
        request={createRequest([
          scopeQuestion,
          {
            id: 'timeline',
            header: 'Time',
            question: 'When should this ship?',
            options: [
              {
                label: 'Now',
                description: 'Ship immediately.',
              },
              {
                label: 'Later',
                description: 'Wait for the next release.',
              },
            ],
          },
        ])}
        onSubmit={onSubmit}
      />,
    );

    const continueButton = screen.getByRole('button', { name: /continue/i });
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Which scope should I use?')).toBeInTheDocument();
    expect(screen.queryByText('When should this ship?')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^2\. Broad$/i }));

    expect(screen.getByText('2 of 2')).toBeInTheDocument();
    expect(screen.getByText('When should this ship?')).toBeInTheDocument();
    expect(continueButton).toBeDisabled();

    fireEvent.change(
      screen.getByPlaceholderText('Type a custom answer'),
      {
        target: { value: 'After design review' },
      },
    );
    expect(continueButton).not.toBeDisabled();

    fireEvent.click(continueButton);
    expect(onSubmit).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'scope',
        type: 'option',
        value: 'Broad',
      }),
      {
        id: 'timeline',
        question: 'When should this ship?',
        type: 'other',
        value: 'After design review',
      },
    ]);
  });

  it('clicking an option on the last answered question submits', () => {
    const onSubmit = vi.fn();
    render(
      <RequestUserInputPanel
        request={createRequest([
          scopeQuestion,
          {
            id: 'timeline',
            header: 'Time',
            question: 'When should this ship?',
            options: [
              {
                label: 'Now',
                description: 'Ship immediately.',
              },
              {
                label: 'Later',
                description: 'Wait for the next release.',
              },
            ],
          },
        ])}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^2\. Broad$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^1\. Now$/i }));

    expect(onSubmit).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'scope',
        value: 'Broad',
      }),
      expect.objectContaining({
        id: 'timeline',
        value: 'Now',
      }),
    ]);
  });

  it('uses theme density to tune vertical spacing', () => {
    themeMock.theme = {
      radius: 'soft',
      density: 'compact',
    };

    render(
      <RequestUserInputPanel
        request={createRequest([scopeQuestion])}
        onSubmit={vi.fn()}
      />,
    );

    const panel = screen.getByLabelText('Input requested');
    expect(panel).toHaveClass('py-2');
    expect(screen.getByRole('button', { name: /^1\. Minimal/i })).toHaveClass(
      'min-h-8',
    );
  });

  it('supports keyboard shortcuts for option selection and dismissal', () => {
    const onSubmit = vi.fn();
    const onDismiss = vi.fn();
    render(
      <RequestUserInputPanel
        request={createRequest([scopeQuestion])}
        onSubmit={onSubmit}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.keyDown(document, { key: '2' });
    expect(screen.getByRole('button', { name: /2\. broad/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'scope',
        value: 'Broad',
      }),
    ]);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('supports left and right question navigation shortcuts', () => {
    render(
      <RequestUserInputPanel
        request={createRequest([
          scopeQuestion,
          {
            id: 'timeline',
            header: 'Time',
            question: 'When should this ship?',
            options: [
              {
                label: 'Now',
                description: 'Ship immediately.',
              },
              {
                label: 'Later',
                description: 'Wait for the next release.',
              },
            ],
          },
        ])}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByText('When should this ship?')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(screen.getByText('Which scope should I use?')).toBeInTheDocument();
  });

  it('renders nothing without a pending request', () => {
    const { container } = render(
      <RequestUserInputPanel request={null} onSubmit={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
