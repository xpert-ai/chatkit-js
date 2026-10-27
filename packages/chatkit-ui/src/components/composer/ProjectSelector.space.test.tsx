import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Client } from '@xpert-ai/xpert-sdk';
import { ProjectSelector } from './ProjectSelector';

vi.mock('../../providers/Theme', () => ({
  useTheme: () => ({
    theme: { radius: 'sharp', density: 'compact', colorScheme: 'dark' },
  }),
}));
vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) => key,
  }),
}));
const space = { applicationKey: 'platform', projectTypeKey: 'space' };
const general = { applicationKey: 'platform', projectTypeKey: 'general' };
function fixture() {
  const types = [general, space].map((type) => ({
    ...type,
    applicationTitle: 'Platform',
    title: type.projectTypeKey,
    available: true,
    binding: { kind: 'project' },
  }));
  const requests: Array<{ url: URL; body?: string }> = [];
  const client = new Client({
    apiUrl: 'https://local.example/api/ai',
    apiKey: 'test',
    callerOptions: {
      maxRetries: 0,
      fetch: async (input: RequestInfo | URL, init: RequestInit = {}) => {
        const url = new URL(String(input));
        requests.push({
          url,
          body: typeof init.body === 'string' ? init.body : undefined,
        });
        const response =
          init.method === 'POST'
            ? { id: 'new-space' }
            : url.pathname.endsWith('/types')
              ? { items: types, defaultProjectType: general }
              : {
                  items:
                    url.searchParams.get('projectTypeKey') === 'space'
                      ? [{ id: 'space-1', name: 'Shared writing', ...space }]
                      : [],
                  total:
                    url.searchParams.get('projectTypeKey') === 'space' ? 1 : 0,
                };
        return new Response(JSON.stringify(response), {
          headers: { 'content-type': 'application/json' },
        });
      },
    },
  });
  return { client, requests };
}
describe('Space Project creation and discovery', () => {
  it('offers Space directly in the creation form even when the Assistant defaults to General', async () => {
    const { client, requests } = fixture();
    const select = vi.fn();
    render(
      <ProjectSelector
        client={client}
        xpertId="assistant"
        createEnabled
        onProjectChange={select}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'composer.projects.select' }),
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'composer.projects.new · general',
      }),
    );
    fireEvent.change(
      screen.getByRole('combobox', { name: 'composer.projects.type' }),
      { target: { value: JSON.stringify(['platform', 'space']) } },
    );
    fireEvent.change(
      screen.getByRole('textbox', {
        name: 'composer.projects.namePlaceholder',
      }),
      { target: { value: 'Writing' } },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'composer.projects.create' }),
    );
    await waitFor(() =>
      expect(select).toHaveBeenCalledWith('new-space', {
        mode: 'existing',
        projectId: 'new-space',
      }),
    );
    expect(
      JSON.parse(requests.find((request) => request.body)?.body ?? '{}'),
    ).toMatchObject({ projectType: space, xpertIds: ['assistant'] });
  });
  it('keeps discovery and creation in the View required type, overriding the default', async () => {
    const { client, requests } = fixture();
    const select = vi.fn();
    render(
      <ProjectSelector
        client={client}
        xpertId="assistant"
        projectType={space}
        allowNone={false}
        createEnabled
        onProjectChange={select}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'composer.projects.select' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Shared writing' }),
    );
    expect(select).toHaveBeenCalledWith('space-1');
    const lists = requests.filter(
      (request) => !request.url.pathname.endsWith('/types'),
    );
    expect(lists.length).toBeGreaterThan(0);
    for (const { url } of lists) {
      expect(url.searchParams.get('projectTypeKey')).toBe('space');
      expect(url.searchParams.get('applicationKey')).toBe('platform');
      expect(url.searchParams.get('xpertId')).toBe('assistant');
    }
    fireEvent.click(
      screen.getByRole('button', { name: 'composer.projects.select' }),
    );
    expect(
      screen.queryByRole('button', { name: 'composer.projects.clearFilter' }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'composer.projects.new · space' }),
    );
    expect(
      screen.getByRole('combobox', { name: 'composer.projects.type' }),
    ).toHaveValue(JSON.stringify(['platform', 'space']));
    expect(
      screen.queryByRole('option', { name: 'Platform / general' }),
    ).not.toBeInTheDocument();
  });
});
