import * as React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectCreationChat } from './ProjectCreationChat';
import type { ChatProps } from './types';

const mocks = vi.hoisted(() => ({
  typeEntry: vi.fn(),
  assistantId: 'assistant',
  enabled: true,
}));
const client = { projects: { typeEntry: mocks.typeEntry } };
vi.mock('../../providers/Stream', () => ({
  useStreamContext: () => ({
    client,
    assistantId: mocks.assistantId,
    projectId: 'old-project',
    threadId: 'old-thread',
  }),
}));
vi.mock('../../workbench/context', () => ({
  useWorkbench: () => ({ enabled: mocks.enabled }),
}));
vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../chat', () => ({
  Chat: ({ onProjectTypeCreate }: ChatProps) => (
    <button
      onClick={() =>
        onProjectTypeCreate?.({ applicationKey: 'app', projectTypeKey: 'type' })
      }
    >
      Create
    </button>
  ),
}));
const entry = {
  kind: 'assistant',
  xpertId: 'assistant',
  slug: 'assistant',
  viewKey: 'app.create',
} as const;

describe('ProjectCreationChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assistantId = 'assistant';
    mocks.enabled = true;
  });

  it('deduplicates clicks and resolves creation without the current Project id', async () => {
    let resolve!: (value: typeof entry) => void;
    mocks.typeEntry.mockReturnValue(
      new Promise<typeof entry>((done) => {
        resolve = done;
      }),
    );
    const onProjectEntry = vi.fn();
    render(
      <ProjectCreationChat creationEnabled onProjectEntry={onProjectEntry} />,
    );
    fireEvent.click(screen.getByText('Create'));
    fireEvent.click(screen.getByText('Create'));
    expect(mocks.typeEntry).toHaveBeenCalledOnce();
    expect(mocks.typeEntry).toHaveBeenCalledWith(
      { applicationKey: 'app', projectTypeKey: 'type' },
      { xpertId: 'assistant', signal: expect.any(AbortSignal) },
    );
    await act(async () => resolve(entry));
    expect(onProjectEntry).toHaveBeenCalledExactlyOnceWith(entry);
  });

  it('displays failures and lets the next click retry', async () => {
    mocks.typeEntry
      .mockRejectedValueOnce(new Error('Creation unavailable'))
      .mockResolvedValue(entry);
    const onProjectEntry = vi.fn();
    render(
      <ProjectCreationChat creationEnabled onProjectEntry={onProjectEntry} />,
    );
    fireEvent.click(screen.getByText('Create'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Creation unavailable',
    );
    expect(onProjectEntry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Create'));
    await waitFor(() => expect(onProjectEntry).toHaveBeenCalledOnce());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each(['assistant-change', 'unmount'] as const)(
    'discards responses after %s',
    async (change) => {
      let resolve!: (value: typeof entry) => void;
      mocks.typeEntry.mockReturnValue(
        new Promise<typeof entry>((done) => {
          resolve = done;
        }),
      );
      const onProjectEntry = vi.fn();
      const { rerender, unmount } = render(
        <ProjectCreationChat creationEnabled onProjectEntry={onProjectEntry} />,
      );
      fireEvent.click(screen.getByText('Create'));
      const signal = mocks.typeEntry.mock.calls[0][1].signal;
      if (change === 'unmount') unmount();
      else {
        mocks.assistantId = 'other';
        rerender(
          <ProjectCreationChat
            creationEnabled
            onProjectEntry={onProjectEntry}
          />,
        );
      }
      await act(async () => resolve(entry));
      expect(signal.aborted).toBe(true);
      expect(onProjectEntry).not.toHaveBeenCalled();
    },
  );

  it.each([
    { ...entry, xpertId: 'other' },
    { ...entry, projectId: 'existing' },
    {
      kind: 'project',
      projectType: { applicationKey: 'app', projectTypeKey: 'type' },
    },
  ])(
    'does not repurpose the session for an incompatible entry',
    async (value) => {
      mocks.typeEntry.mockResolvedValue(value);
      const onProjectEntry = vi.fn();
      render(
        <ProjectCreationChat creationEnabled onProjectEntry={onProjectEntry} />,
      );
      fireEvent.click(screen.getByText('Create'));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'creationViewUnavailable',
      );
      expect(onProjectEntry).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    'does not query when creation is disabled or Workbench unavailable (%s)',
    (creationEnabled) => {
      mocks.enabled = !creationEnabled;
      render(
        <ProjectCreationChat
          creationEnabled={creationEnabled}
          onProjectEntry={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByText('Create'));
      expect(mocks.typeEntry).not.toHaveBeenCalled();
    },
  );
});
