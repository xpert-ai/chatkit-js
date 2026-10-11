import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
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
const key = (name: string) => `composer.projects.${name}`;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
function fixture(create: (init: RequestInit) => Promise<Response>) {
  const requests: RequestInit[] = [];
  const fetcher = vi.fn<typeof fetch>(async (url, init = {}) => {
    if (init.method === 'POST') {
      requests.push(init);
      return create(init);
    }
    if (String(url).includes('/types'))
      return json({
        items: [],
        defaultProjectType: {
          applicationKey: 'platform',
          projectTypeKey: 'general',
        },
      });
    return json({ items: [], total: 0 });
  });
  const client = new Client({
    apiUrl: 'https://local.example/api/ai',
    apiKey: 'scoped-session',
    callerOptions: { fetch: fetcher, maxRetries: 0 },
    onRequest: (_url, init) => ({
      ...init,
      headers: { ...init.headers, 'organization-id': 'current-org' },
    }),
  });
  return { client, requests };
}
async function enterName() {
  fireEvent.click(screen.getByRole('button', { name: key('select') }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: key('new') })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole('button', { name: key('new') }));
  fireEvent.change(
    screen.getByRole('textbox', { name: key('namePlaceholder') }),
    { target: { value: 'Acceptance project' } },
  );
}
describe('ChatKit direct project creation', () => {
  it('creates with the scoped SDK and selects the persisted Project without a host callback', async () => {
    let complete!: (value: Response) => void;
    const { client, requests } = fixture(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const select = vi.fn();
    render(
      <ProjectSelector
        client={client}
        xpertId="assistant"
        createEnabled
        onProjectChange={select}
      />,
    );
    await enterName();
    fireEvent.click(screen.getByRole('button', { name: key('create') }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(
      screen.getByRole('button', { name: key('creating') }),
    ).toBeDisabled();
    expect(select).not.toHaveBeenCalled();
    expect(JSON.parse(String(requests[0].body))).toEqual({
      name: 'Acceptance project',
      xpertIds: ['assistant'],
      projectType: { applicationKey: 'platform', projectTypeKey: 'general' },
    });
    expect(requests[0].headers).toMatchObject({
      'organization-id': 'current-org',
      'x-api-key': 'scoped-session',
    });
    await act(async () =>
      complete(
        json(
          { id: 'created', name: 'Acceptance project', status: 'active' },
          201,
        ),
      ),
    );
    await waitFor(() =>
      expect(select).toHaveBeenCalledWith('created', {
        mode: 'existing',
        projectId: 'created',
      }),
    );
    expect(
      screen.queryByRole('textbox', { name: key('namePlaceholder') }),
    ).not.toBeInTheDocument();
  });
  it('retains the form on denied creation and allows retry', async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(json({ message: 'Denied' }, 403))
      .mockResolvedValueOnce(json({ id: 'created' }, 201));
    const { client } = fixture(create);
    const select = vi.fn();
    render(
      <ProjectSelector
        client={client}
        xpertId="assistant"
        createEnabled
        onProjectChange={select}
      />,
    );
    await enterName();
    fireEvent.click(screen.getByRole('button', { name: key('create') }));
    await screen.findByRole('alert');
    expect(select).not.toHaveBeenCalled();
    expect(
      screen.getByRole('textbox', { name: key('namePlaceholder') }),
    ).toHaveValue('Acceptance project');
    fireEvent.click(screen.getByRole('button', { name: key('create') }));
    await waitFor(() => expect(select).toHaveBeenCalledOnce());
  });
  it('discards a creation result when the Assistant context changes', async () => {
    let complete!: (value: Response) => void;
    const { client, requests } = fixture(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const select = vi.fn();
    const view = render(
      <ProjectSelector
        client={client}
        xpertId="assistant"
        createEnabled
        onProjectChange={select}
      />,
    );
    await enterName();
    fireEvent.click(screen.getByRole('button', { name: key('create') }));
    await waitFor(() => expect(requests).toHaveLength(1));
    view.rerender(
      <ProjectSelector
        client={client}
        xpertId="other"
        createEnabled
        onProjectChange={select}
      />,
    );
    expect(requests[0].signal?.aborted).toBe(true);
    await act(async () => complete(json({ id: 'old-project' }, 201)));
    expect(select).not.toHaveBeenCalled();
  });
});
