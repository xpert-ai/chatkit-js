import { useState, type ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { XpertProjectTypeSummary } from '@xpert-ai/xpert-sdk';
import { ThemeProvider } from '../../providers/Theme';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { ProjectCreateForm } from './ProjectCreateForm';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) => key,
  }),
}));

const types: XpertProjectTypeSummary[] = [
  {
    applicationKey: 'platform',
    projectTypeKey: 'general',
    applicationTitle: 'Platform',
    title: 'General',
    binding: { kind: 'project' },
    available: true,
  },
  {
    applicationKey: 'platform',
    projectTypeKey: 'space',
    applicationTitle: 'Platform',
    title: 'Space',
    binding: { kind: 'project' },
    available: true,
  },
  {
    applicationKey: 'platform',
    projectTypeKey: 'archived',
    applicationTitle: 'Platform',
    title: 'Unavailable',
    binding: { kind: 'project' },
    available: false,
  },
];

function Form({ theme }: Pick<ComponentProps<typeof ThemeProvider>, 'theme'>) {
  const [projectType, setProjectType] = useState({
    applicationKey: 'platform',
    projectTypeKey: 'general',
  });
  const [name, setName] = useState('Draft');
  return (
    <ThemeProvider theme={theme}>
      <Popover defaultOpen>
        <PopoverTrigger>Projects</PopoverTrigger>
        <PopoverContent>
          <ProjectCreateForm
            types={types}
            projectType={projectType}
            onTypeChange={setProjectType}
            name={name}
            onNameChange={setName}
            creating={false}
            error={false}
            canCreate
            onCancel={() => {}}
            onSubmit={(event) => event.preventDefault()}
          />
        </PopoverContent>
      </Popover>
    </ThemeProvider>
  );
}

describe('project creation type select', () => {
  it('selects a type inside the project popover without losing the draft', async () => {
    render(<Form />);
    const trigger = screen.getByRole('combobox', {
      name: 'composer.projects.type',
    });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(
      await screen.findByRole('option', { name: 'Platform / Unavailable' }),
    ).toHaveAttribute('aria-disabled', 'true');
    fireEvent.keyDown(
      screen.getByRole('option', { name: 'Platform / Space' }),
      {
        key: 'Enter',
      },
    );
    await waitFor(() => expect(trigger).toHaveTextContent('Platform / Space'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Draft');
    expect(
      screen.getByRole('button', { name: 'composer.projects.create' }),
    ).toBeEnabled();
  });

  it('updates the nested select portal while its theme changes', async () => {
    const { container, rerender } = render(
      <Form
        theme={{ radius: 'sharp', density: 'compact', colorScheme: 'light' }}
      />,
    );
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    const content = await screen.findByRole('listbox');
    expect(container.contains(content)).toBe(false);
    expect(content.style.getPropertyValue('--chat-panel-radius')).toBe('0px');
    expect(content.style.getPropertyValue('--chat-item-radius')).toBe('0px');
    expect(content.style.getPropertyValue('--chat-density-scale')).toBe('0.75');

    rerender(
      <Form
        theme={{ radius: 'round', density: 'spacious', colorScheme: 'dark' }}
      />,
    );
    expect(content).toBeVisible();
    expect(content.style.getPropertyValue('--chat-panel-radius')).toBe(
      'calc(var(--radius, 0.625rem) + 4px)',
    );
    expect(content.style.getPropertyValue('--chat-item-radius')).toBe(
      'var(--radius, 0.625rem)',
    );
    expect(content.style.getPropertyValue('--chat-density-scale')).toBe('1.25');
    expect(document.documentElement).toHaveClass('dark');
  });
});
