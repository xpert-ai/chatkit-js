import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@xpert-ai/xpert-sdk';
import { ProjectSelector } from './ProjectSelector';
import { ToolAfterPanel } from './tool-after-panel';

const stream = vi.hoisted(() => ({
  isReady: false,
  runtimeScopeReady: false,
  isLoading: false,
  threadId: 'thread-1',
  historyMessageLoadVersion: 0,
  client: { threads: { get: vi.fn().mockResolvedValue({ operation: null }) } },
}));
vi.mock('../../providers/Stream', () => ({ useStreamContext: () => stream }));
vi.mock('../../providers/Theme', () => ({
  useTheme: () => ({ theme: { radius: 'soft' } }),
}));
vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
afterEach(cleanup);

describe('composer authentication readiness', () => {
  it('defers catalog, project-name and list requests until the credential is ready', async () => {
    const client = new Client({ apiUrl: 'https://example.test/api/ai' });
    const types = vi
      .spyOn(client.projects, 'types')
      .mockResolvedValue({ items: [] });
    const get = vi
      .spyOn(client.projects, 'get')
      .mockResolvedValue({ id: 'project', name: 'Project', status: 'active' });
    const list = vi
      .spyOn(client.projects, 'list')
      .mockResolvedValue({ items: [], total: 0 });
    const { rerender } = render(
      <ProjectSelector
        client={client}
        xpertId="assistant"
        activeProjectId="project"
        ready={false}
        disabled
      />,
    );
    expect(types).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
    rerender(
      <ProjectSelector
        client={client}
        xpertId="assistant"
        activeProjectId="project"
        ready
      />,
    );
    await waitFor(() => expect(list).toHaveBeenCalledOnce());
    expect(types).toHaveBeenCalledOnce();
    expect(get).toHaveBeenCalledOnce();
  });

  it('defers tool continuation inspection until authentication and history are ready', async () => {
    stream.isReady = false;
    stream.runtimeScopeReady = false;
    stream.client.threads.get.mockClear();
    const { rerender } = render(<ToolAfterPanel />);
    expect(stream.client.threads.get).not.toHaveBeenCalled();
    stream.isReady = true;
    rerender(<ToolAfterPanel />);
    expect(stream.client.threads.get).not.toHaveBeenCalled();
    stream.runtimeScopeReady = true;
    rerender(<ToolAfterPanel />);
    await waitFor(() =>
      expect(stream.client.threads.get).toHaveBeenCalledOnce(),
    );
  });
});
