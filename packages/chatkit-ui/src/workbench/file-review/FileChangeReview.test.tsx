import { Blob as NodeBlob } from 'node:buffer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageFileActivity } from '../../components/task-summary/FileActivity';
import { setupWorkbenchTests, fixture } from '../WorkbenchShell.test-fixture';
import { createFileChangeReview } from './file-change-review';
import { diffRows } from './file-change-diff';
import { Client } from '@xpert-ai/xpert-sdk';
import {
  countFileChangeLines,
  type FileChangeReport,
  type FileChangeResource,
} from '@xpert-ai/chatkit-types';

const {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  mocks,
  WorkbenchShell,
  baseOptions,
  setObservedWidth,
} = fixture;
const resource: FileChangeResource = {
  type: 'file_change',
  first: { artifactId: 'report', artifactVersionId: 'v1' },
  last: { artifactId: 'report', artifactVersionId: 'v2' },
};
const revision = (text: string) => ({
  text,
  size: text.length,
  sha256: 'a'.repeat(64),
});
const first: FileChangeReport = {
  schema: 'xpert.file-change.v1',
  workspacePath: 'src/index.html',
  before: revision('same\nold\n'),
  after: revision('intermediate\n'),
};
const last: FileChangeReport = {
  ...first,
  before: first.after,
  after: revision('same\nnew\nextra\n'),
};
const change = {
  before: { sha256: 'a'.repeat(64), size: 1 },
  after: { sha256: 'b'.repeat(64), size: 2 },
  id: 'change',
  title: 'index.html',
  workspacePath: first.workspacePath,
  operation: 'modified' as const,
  coverage: 'observed' as const,
  resource,
};
const onRequestContextChange = vi.fn();
const ui = () => (
  <WorkbenchShell
    options={{ ...baseOptions, workbench: { enabled: true } }}
    locale="en-US"
    onRequestContextChange={onRequestContextChange}
  >
    <MessageFileActivity
      message={{
        id: 'message',
        content: '',
        taskSummary: { version: 1, fileChanges: [change] },
      }}
    />
  </WorkbenchShell>
);

describe('ChatKit native change review', () => {
  setupWorkbenchTests();
  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob);
    mocks.listSlotViews.mockResolvedValue([]);
    mocks.stream.client.workbench.downloadArtifact
      .mockReset()
      .mockImplementation(
        async (_conversation, ref) =>
          new Blob(
            [JSON.stringify(ref.artifactVersionId === 'v1' ? first : last)],
            { type: 'application/json' },
          ),
      );
    mocks.stream.client.conversations.listTaskSummaryItems.mockReset();
  });
  it('opens the review command without a host, diffs first-before against last-after, and supports view controls', async () => {
    const { container, rerender } = render(ui());
    setObservedWidth(1200);
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    expect(
      await screen.findByRole('tab', { name: 'Review' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        container.querySelector('[data-diff-kind="added"]'),
      ).not.toBeNull(),
    );
    expect(screen.getByText('old')).toBeInTheDocument();
    expect(screen.getByText('new')).toBeInTheDocument();
    expect(screen.queryByText('intermediate')).not.toBeInTheDocument();
    expect(
      mocks.stream.client.workbench.downloadArtifact,
    ).toHaveBeenCalledTimes(2);
    rerender(ui());
    expect(
      mocks.stream.client.workbench.downloadArtifact,
    ).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Side by side' }));
    expect(screen.getByRole('button', { name: 'Inline' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Version details' }));
    expect(screen.getAllByText(/SHA-256/)).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(container.querySelector('[data-diff-kind="added"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Review src/index.html' }),
    );
    expect(screen.getAllByRole('tab', { name: 'Review' })).toHaveLength(1);
  });
  it('paginates conversation changes and keeps unavailable/binary files visible', async () => {
    mocks.stream.client.conversations.listTaskSummaryItems
      .mockResolvedValueOnce({ items: [change], total: 2 })
      .mockResolvedValueOnce({
        items: [
          {
            ...change,
            id: 'legacy',
            workspacePath: 'other.bin',
            resource: undefined,
            coverage: 'legacy',
          },
        ],
        total: 2,
      });
    render(ui());
    setObservedWidth(1200);
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    await screen.findByText('new');
    fireEvent.click(
      screen.getByRole('button', { name: 'Conversation changes' }),
    );
    expect(
      await screen.findByText(/This saved change is unavailable/),
    ).toBeInTheDocument();
    expect(
      mocks.stream.client.conversations.listTaskSummaryItems,
    ).toHaveBeenLastCalledWith('conversation-1', 'fileChanges', {
      offset: 1,
      limit: 50,
      signal: expect.any(AbortSignal),
    });
    expect(screen.getAllByText('other.bin').length).toBeGreaterThan(0);
  });
  it('shows partial denial without using current files, and retries the same range', async () => {
    mocks.stream.client.workbench.downloadArtifact.mockRejectedValue(
      new Error('Forbidden'),
    );
    render(ui());
    setObservedWidth(1200);
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    await screen.findByText(/This saved change is unavailable/);
    mocks.stream.client.workbench.downloadArtifact.mockImplementation(
      async (_c, ref) =>
        new Blob([
          JSON.stringify(ref.artifactVersionId === 'v1' ? first : last),
        ]),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('new')).toBeInTheDocument();
  });
  it('aborts pending reads and ignores late reports on conversation change', async () => {
    let done!: (value: Blob) => void;
    mocks.stream.client.workbench.downloadArtifact.mockImplementation(
      () =>
        new Promise((resolve) => {
          done = resolve;
        }),
    );
    const { rerender } = render(ui());
    setObservedWidth(1200);
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    await waitFor(() =>
      expect(mocks.stream.client.workbench.downloadArtifact).toHaveBeenCalled(),
    );
    const signal =
      mocks.stream.client.workbench.downloadArtifact.mock.calls[0][2].signal;
    mocks.stream.conversationId = 'another';
    rerender(ui());
    expect(signal.aborted).toBe(true);
    await act(async () => {
      done(new Blob([JSON.stringify(last)]));
    });
    expect(
      screen.queryByRole('tab', { name: 'Review' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('new')).not.toBeInTheDocument();
  });
});

describe('immutable review loading and bounded diff', () => {
  it('shares a single request for identical endpoints and rejects malformed or path-mismatched reports', async () => {
    const client = new Client({ apiUrl: '/api/ai' });
    const read = vi
      .spyOn(client.workbench, 'downloadArtifact')
      .mockResolvedValue(new Blob([JSON.stringify(first)]));
    const single = { ...resource, last: resource.first };
    const options = createFileChangeReview(
      client,
      'c',
      single,
      'Review',
    ).review!;
    expect(
      (await options.load('selected', new AbortController().signal))[0].report,
    ).toEqual(first);
    expect(read).toHaveBeenCalledOnce();
    read.mockResolvedValueOnce(new Blob(['{}']));
    expect(
      (await options.load('selected', new AbortController().signal))[0].report,
    ).toBeUndefined();
  });
  it('aligns changes with line counts and handles additions, deletion, CRLF and large inputs', () => {
    for (const [before, after] of [
      ['a\nold\nz\n', 'a\nnew\nz\n'],
      ['', 'new\n'],
      ['gone\n', ''],
      ['a\r\n', 'a\n'],
    ]) {
      const rows = diffRows(before, after)!;
      const report: FileChangeReport = {
        ...first,
        before: revision(before),
        after: revision(after),
      };
      expect(countFileChangeLines(report)).toEqual({
        status: 'ready',
        added: rows.filter((r) => !r.equal && r.after).length,
        removed: rows.filter((r) => !r.equal && r.before).length,
      });
      expect(rows.flatMap((r) => (r.before ? [r.before.text] : []))).toEqual(
        before
          ? before.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n')
          : [],
      );
      expect(rows.flatMap((r) => (r.after ? [r.after.text] : []))).toEqual(
        after
          ? after.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n')
          : [],
      );
    }
    expect(diffRows('a\n'.repeat(3000), 'b\n'.repeat(3000))).toBeNull();
  });
});
