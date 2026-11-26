import * as React from 'react';
import { Blob as NodeBlob } from 'node:buffer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatTaskSummaryOutput } from '@xpert-ai/chatkit-types';
import { TaskSummaryPanel } from '../../components/task-summary/TaskSummary';
import { useOpenTaskSummaryResource } from '../../hooks/useOpenTaskSummaryResource';
import {
  collectLiveTaskSummary,
  mergeTaskSummary,
} from '../../lib/task-summary';
import { ParentMessengerContext } from '../../providers/ParentMessenger';
import { fixture, setupWorkbenchTests } from '../WorkbenchShell.test-fixture';

const {
  render,
  screen,
  fireEvent,
  waitFor,
  mocks,
  WorkbenchShell,
  baseOptions,
  setObservedWidth,
  manifest,
} = fixture;
const output: ChatTaskSummaryOutput = {
  id: 'document',
  kind: 'document',
  title: 'Project proposal.docx',
  resource: {
    type: 'workspace_file',
    workspacePath: 'documents/proposal.docx',
  },
};
const sendEvent = vi.fn();
const content = { resolveFile: vi.fn() };
const messenger: NonNullable<React.ContextType<typeof ParentMessengerContext>> =
  {
    sendEvent,
    isParentAvailable: true,
    sendCommand: vi.fn(),
    updateComposer: vi.fn(),
    focusComposer: vi.fn(),
    registerOnSetOptions: vi.fn(),
    registerOnSetPetEnabled: vi.fn(),
    registerOnSetComposerValue: vi.fn(),
    registerOnSetRuntimeCapabilities: vi.fn(),
    registerOnFocusComposer: vi.fn(),
  };
function Summary({
  item,
  conversationId,
}: {
  item: ChatTaskSummaryOutput;
  conversationId: string;
}) {
  const open = useOpenTaskSummaryResource([item], conversationId);
  const empty = mergeTaskSummary(
    null,
    collectLiveTaskSummary({ messages: [] }),
  );
  const summary = {
    ...empty,
    outputs: [{ ...item, messageId: 'reply' }],
    totals: { ...empty.totals, outputs: 1 },
  };
  return (
    <TaskSummaryPanel
      summary={summary}
      onOpenResource={open}
      onRetryHistory={vi.fn()}
      onLoadSection={vi.fn()}
      onNavigateMessage={vi.fn()}
      onFocusComposer={vi.fn()}
    />
  );
}
function ui(item = output, enabled = true, conversationId = 'conversation-1') {
  return (
    <ParentMessengerContext.Provider value={messenger}>
      <WorkbenchShell
        options={{
          ...baseOptions,
          workbench: { enabled, sideChat: { enabled: false } },
        }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <Summary item={item} conversationId={conversationId} />
      </WorkbenchShell>
    </ParentMessengerContext.Provider>
  );
}
async function open(item = output) {
  setObservedWidth(1200);
  fireEvent.click(
    await screen.findByRole('button', {
      name: (name) => name.startsWith(item.title),
    }),
  );
}
describe('Task summary output navigation', () => {
  setupWorkbenchTests();
  beforeEach(() => {
    content.resolveFile.mockReset();
    Object.assign(mocks.stream.client, { content });
    vi.stubGlobal('Blob', NodeBlob);
    URL.createObjectURL = vi.fn(() => 'blob:summary-output');
    URL.revokeObjectURL = vi.fn();
    mocks.listSlotViews.mockResolvedValue([manifest]);
    content.resolveFile.mockResolvedValue({
      viewKey: manifest.key,
      selectionId: 'document-1',
      parameters: { contentProvider: 'spaces', contentId: 'content-1' },
    });
    sendEvent.mockReset();
  });
  it('opens ordinary workspace files in the native editor with conversation scope', async () => {
    const item: ChatTaskSummaryOutput = {
      ...output,
      title: 'notes.md',
      mimeType: 'text/markdown',
      resource: { type: 'workspace_file', workspacePath: 'documents/notes.md' },
    };
    mocks.stream.client.workbench.readFile.mockReset().mockResolvedValue({
      filePath: 'documents/notes.md',
      capabilities: { canRead: true, canWrite: true },
    });
    mocks.stream.client.workbench.downloadFile
      .mockReset()
      .mockResolvedValue(
        new Blob(['# Summary output body'], { type: 'text/markdown' }),
      );
    render(ui(item));
    await open(item);
    expect(
      await screen.findByRole('textbox', { name: 'Markdown document' }),
    ).toHaveTextContent('Summary output body');
    expect(mocks.stream.client.workbench.downloadFile).toHaveBeenCalledWith(
      { kind: 'conversation', conversationId: 'conversation-1' },
      'documents/notes.md',
      { signal: expect.any(AbortSignal) },
    );
    expect(sendEvent).not.toHaveBeenCalled();
  });
  it('opens a legacy workspace DOCX output in the resolved document editor', async () => {
    render(ui());
    await open();
    await waitFor(() =>
      expect(mocks.remoteViewProps?.initialQuery).toEqual({
        selectionId: 'document-1',
        parameters: { contentProvider: 'spaces', contentId: 'content-1' },
      }),
    );
    expect(content.resolveFile).toHaveBeenCalledWith(
      { assistantId: 'agent-1', projectId: 'project-1' },
      { path: 'documents/proposal.docx' },
    );
    expect(sendEvent).not.toHaveBeenCalled();
  });
  it('shows an error if the file editor cannot be resolved', async () => {
    content.resolveFile.mockRejectedValue(new Error('missing'));
    render(ui());
    await open();
    expect(
      await screen.findByText(/Open this file in a Project/),
    ).toBeVisible();
    expect(sendEvent).not.toHaveBeenCalled();
  });
  it.each(['url', 'browser'] as const)(
    'opens %s outputs in a browser tab',
    async (type) => {
      const item: ChatTaskSummaryOutput = {
        ...output,
        title: 'Published preview',
        resource: { type, url: 'https://example.com/preview' },
      };
      render(ui(item));
      await open(item);
      await waitFor(() =>
        expect(
          document.querySelector('iframe[src="https://example.com/preview"]'),
        ).toBeInTheDocument(),
      );
      expect(sendEvent).not.toHaveBeenCalled();
    },
  );
  it.each([
    { type: 'workspace_file' as const, workspacePath: '../outside.docx' },
    { type: 'url' as const, url: 'javascript:alert(1)' },
  ])('rejects invalid resource locations: $type', async (resource) => {
    const item = { ...output, resource };
    render(ui(item));
    await open(item);
    await waitFor(() =>
      expect(
        document.querySelector('[data-sonner-toast][data-type="error"]'),
      ).toBeInTheDocument(),
    );
    expect(content.resolveFile).not.toHaveBeenCalled();
    expect(sendEvent).not.toHaveBeenCalled();
  });
  it.each([
    { enabled: false, conversationId: 'conversation-1' },
    { enabled: true, conversationId: 'other-conversation' },
  ])(
    'retains host fallback outside the active Workbench: %j',
    async ({ enabled, conversationId }) => {
      render(ui(output, enabled, conversationId));
      await open();
      expect(sendEvent).toHaveBeenCalledWith('public_event', [
        'effect',
        {
          name: 'task_summary.open_resource',
          data: {
            resource: output.resource,
            messageId: 'reply',
            title: output.title,
            conversationId,
          },
        },
      ]);
      expect(content.resolveFile).not.toHaveBeenCalled();
    },
  );
});
