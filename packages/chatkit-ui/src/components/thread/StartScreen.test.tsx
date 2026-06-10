import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StartScreen } from './StartScreen';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string) =>
      ({
        'startScreen.greeting': 'What can I help with today?',
        'startScreen.editPrompt': 'Edit prompt',
      })[key] ?? key,
  }),
}));

const startScreen = {
  prompts: [
    {
      label: 'Analyze notice',
      prompt: 'Analyze this technical notice',
      icon: 'circle-question' as const,
    },
  ],
};

describe('StartScreen', () => {
  it('keeps prompt send and edit actions separate', () => {
    const onPromptClick = vi.fn();
    const onPromptEdit = vi.fn();

    render(
      <StartScreen
        startScreen={startScreen}
        onPromptClick={onPromptClick}
        onPromptEdit={onPromptEdit}
      />,
    );

    fireEvent.click(screen.getByText('Analyze notice'));
    expect(onPromptClick).toHaveBeenCalledWith('Analyze this technical notice');
    expect(onPromptEdit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Edit prompt'));
    expect(onPromptEdit).toHaveBeenCalledWith('Analyze this technical notice');
    expect(onPromptClick).toHaveBeenCalledTimes(1);
  });

  it('disables prompt send and edit buttons independently', () => {
    render(
      <StartScreen
        startScreen={startScreen}
        promptSendDisabled
        promptEditDisabled
      />,
    );

    expect(screen.getByText('Analyze notice').closest('button')).toBeDisabled();
    expect(screen.getByLabelText('Edit prompt')).toBeDisabled();
  });
});
