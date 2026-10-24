import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ContentClient, type ContentReviewState } from '@xpert-ai/xpert-sdk';
import { ThemeProvider } from '../../providers/Theme';
import { ContentReview } from './ContentReview';
import { EditorLifecycle } from '../editors/editor-lifecycle';
const state: ContentReviewState = {
  document: {
    id: 'doc',
    resourceRef: { providerKey: 'platform.project.file', resourceId: 'doc' },
    projectId: 'project',
    path: 'plan.md',
    title: 'Plan',
    modelKey: 'markdown',
    schemaVersion: 1,
    epoch: 2,
    headRevisionId: 'rev',
    fileHash: 'hash',
    sequence: 7,
    status: 'ready',
  },
  markdown: 'Current',
  canWrite: true,
  externalChange: false,
  external: null,
  comments: [],
  revisions: [],
  proposals: [
    {
      id: 'proposal',
      resourceId: 'doc',
      mutationId: 'mutation',
      epoch: 2,
      sequence: 7,
      blockId: 'block',
      before: 'Old',
      after: 'New',
      status: 'pending',
      createdById: 'user',
      assistantId: 'assistant',
    },
  ],
};
function setup(value = state) {
  const api = new ContentClient({ json: vi.fn() });
  vi.spyOn(api, 'mutate').mockResolvedValue({});
  vi.spyOn(api, 'review').mockResolvedValue(value);
  const editors = new EditorLifecycle(),
    close = vi.fn(),
    reopen = vi.fn(async () => {}),
    ask = vi.fn(async (_text: string) => ({ success: true }));
  render(
    <ThemeProvider>
      <ContentReview
        session={{
          resourceId: 'doc',
          blockId: 'block',
          viewKey: 'editor',
          state: value,
        }}
        api={api}
        scope={{ assistantId: 'assistant', projectId: 'project' }}
        editors={editors}
        close={close}
        reopen={reopen}
        ask={ask}
      />
    </ThemeProvider>,
  );
  return { api, editors, close, reopen, ask };
}
describe('Assistant content review', () => {
  it('accepts a proposal through SDK and reloads the review', async () => {
    const { api } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Accept change' }));
    await waitFor(() =>
      expect(api.mutate).toHaveBeenCalledWith(
        { assistantId: 'assistant', projectId: 'project' },
        'doc',
        { operation: 'decide', proposalId: 'proposal', accept: true },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(api.review).toHaveBeenCalledOnce();
  });
  it('retains a failed save and sends no mutation', async () => {
    const { api, editors } = setup();
    editors.register('one', {
      tabKey: 'editor',
      dirty: true,
      prepare: async () => false,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Accept change' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unsaved changes',
    );
    expect(api.mutate).not.toHaveBeenCalled();
  });
  it('uses the displayed sequence and file hash to reconcile before reopening the editor', async () => {
    const { api, reopen, close } = setup({
      ...state,
      externalChange: true,
      external: { hash: 'external-hash', markdown: 'External' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use external file' }));
    await waitFor(() =>
      expect(api.mutate).toHaveBeenCalledWith(
        expect.anything(),
        'doc',
        {
          operation: 'reconcile',
          choice: 'file',
          expectedHash: 'external-hash',
          epoch: 2,
          expectedSequence: 7,
        },
        expect.anything(),
      ),
    );
    expect(reopen).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
  it('forwards an instruction to the Assistant without doing AI work in the editor', async () => {
    const { ask } = setup();
    fireEvent.change(
      screen.getByPlaceholderText(
        'For example: shorten section two and keep the key data',
      ),
      { target: { value: 'Shorten the plan' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send to Assistant' }));
    await waitFor(() =>
      expect(ask).toHaveBeenCalledWith(
        expect.stringContaining('Shorten the plan'),
      ),
    );
    expect(ask.mock.calls[0]?.[0]).toContain('plan.md');
  });
});
