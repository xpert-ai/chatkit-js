import * as React from 'react';
import { Blob as NodeBlob } from 'node:buffer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatTaskSummaryOutput } from '@xpert-ai/chatkit-types';
import { MessageFileActivity } from '../../components/task-summary/FileActivity';
import { useOpenTaskSummaryResource } from '../../hooks/useOpenTaskSummaryResource';
import { ParentMessengerContext } from '../../providers/ParentMessenger';
import { fixture, setupWorkbenchTests } from '../WorkbenchShell.test-fixture';

vi.mock('../../components/code-editor/CodeEditor', () => ({
  default: ({
    value,
    readOnly,
    onChange,
  }: {
    value: string;
    readOnly?: boolean;
    onChange?: (value: string) => void;
  }) => (
    <textarea
      aria-label="File source"
      readOnly={readOnly}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));
const {
  render,
  screen,
  fireEvent,
  waitFor,
  mocks,
  WorkbenchShell,
  baseOptions,
  setObservedWidth,
  ThemeProvider,
} = fixture;
const resource = {
  type: 'artifact' as const,
  artifactId: 'delivery',
  artifactVersionId: 'v1',
};
const output: ChatTaskSummaryOutput = {
  id: 'out',
  kind: 'document',
  origin: 'tool',
  title: '交付说明.md',
  mimeType: 'text/markdown',
  workspacePath: 'deliverables/交付说明.md',
  resource,
};
const sendEvent = vi.fn();
const messenger = {
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
const blob = (text: string) => new Blob([text], { type: 'text/markdown' });
function ScopedLauncher({
  item,
  conversationId,
}: {
  item: ChatTaskSummaryOutput;
  conversationId: string;
}) {
  const open = useOpenTaskSummaryResource([item], conversationId);
  return (
    <button onClick={() => open(resource, 'message', item.title)}>
      Open 交付说明.md
    </button>
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
        {conversationId === 'conversation-1' ? (
          <MessageFileActivity
            message={{
              id: 'message',
              content: '',
              taskSummary: { version: 1, outputs: [item] },
            }}
          />
        ) : (
          <ScopedLauncher item={item} conversationId={conversationId} />
        )}
      </WorkbenchShell>
    </ParentMessengerContext.Provider>
  );
}
async function open() {
  setObservedWidth(1200);
  fireEvent.click(
    await screen.findByRole('button', { name: /Open 交付说明.md/ }),
  );
}
describe('saved file delivery routing', () => {
  setupWorkbenchTests();
  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob);
    URL.createObjectURL = vi.fn(() => 'blob:delivery');
    URL.revokeObjectURL = vi.fn();
    mocks.listSlotViews.mockResolvedValue([]);
    mocks.stream.client.workbench.downloadArtifact
      .mockReset()
      .mockResolvedValue(blob('# 已保存版本\n\n中文正文'));
    mocks.stream.client.workbench.downloadFile
      .mockReset()
      .mockResolvedValue(blob('# 工作区当前版本'));
    mocks.stream.client.workbench.saveFile
      .mockReset()
      .mockResolvedValue({ filePath: output.workspacePath });
    mocks.stream.client.workbench.readFile.mockReset().mockResolvedValue({
      filePath: output.workspacePath,
      capabilities: { canRead: true, canWrite: false },
    });
    sendEvent.mockReset();
  });
  it('opens writable Markdown directly in the workspace rich editor', async () => {
    mocks.stream.client.workbench.readFile.mockResolvedValue({
      filePath: output.workspacePath,
      capabilities: { canRead: true, canWrite: true },
    });
    render(ui());
    await open();
    const editor = await screen.findByRole('textbox', {
      name: 'Markdown document',
    });
    expect(editor).toHaveAttribute('contenteditable', 'true');
    expect(editor).toHaveTextContent('工作区当前版本');
    expect(
      screen.getByRole('toolbar', { name: 'Markdown formatting' }),
    ).toBeVisible();
    expect(sendEvent).not.toHaveBeenCalled();
    expect(
      mocks.stream.client.workbench.downloadArtifact,
    ).not.toHaveBeenCalled();
    expect(mocks.stream.client.workbench.downloadFile).toHaveBeenCalledWith(
      { kind: 'conversation', conversationId: 'conversation-1' },
      output.workspacePath,
      { signal: expect.any(AbortSignal) },
    );
  });
  it.each([undefined, { canRead: true, canWrite: false }])(
    'shows the saved Markdown read-only when write authority is %j',
    async (capabilities) => {
      mocks.stream.client.workbench.readFile.mockResolvedValue({
        filePath: output.workspacePath,
        capabilities,
      });
      render(ui());
      await open();
      expect(
        await screen.findByRole('heading', { name: '已保存版本' }),
      ).toBeVisible();
      expect(
        screen.getByRole('textbox', { name: 'Markdown document' }),
      ).toHaveAttribute('contenteditable', 'false');
      expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
      expect(screen.queryByRole('toolbar')).toBeNull();
      expect(mocks.stream.client.workbench.downloadFile).not.toHaveBeenCalled();
    },
  );
  it.each([undefined, '../outside.md', '/workspace/outside.md'])(
    'does not offer editing for missing or unsafe workspace path %s',
    async (workspacePath) => {
      render(ui({ ...output, workspacePath }));
      await open();
      await screen.findByRole('heading', { name: '已保存版本' });
      expect(
        screen.queryByRole('button', { name: 'Edit workspace file' }),
      ).toBeNull();
    },
  );
  it.each([
    ['disabled', false, 'conversation-1'],
    ['other conversation', true, 'conversation-other'],
  ] as const)(
    'falls back to host for %s',
    async (_, enabled, conversationId) => {
      render(ui(output, enabled, conversationId));
      await open();
      expect(sendEvent).toHaveBeenCalledWith('public_event', [
        'effect',
        expect.objectContaining({
          name: 'task_summary.open_resource',
          data: expect.objectContaining({ resource }),
        }),
      ]);
      expect(
        mocks.stream.client.workbench.downloadArtifact,
      ).not.toHaveBeenCalled();
    },
  );
  it('cancels a preview when the conversation changes', async () => {
    let resolve!: (blob: Blob) => void;
    mocks.stream.client.workbench.downloadArtifact.mockReturnValue(
      new Promise<Blob>((done) => {
        resolve = done;
      }),
    );
    const { rerender } = render(ui());
    await open();
    await waitFor(() =>
      expect(mocks.stream.client.workbench.downloadArtifact).toHaveBeenCalled(),
    );
    const signal =
      mocks.stream.client.workbench.downloadArtifact.mock.calls[0][2].signal;
    mocks.stream.conversationId = 'conversation-2';
    mocks.stream.threadId = 'thread-2';
    rerender(ui(output, true, 'conversation-2'));
    await waitFor(() => expect(signal.aborted).toBe(true));
    resolve(blob('# late private content'));
    expect(
      screen.queryByRole('heading', { name: 'late private content' }),
    ).toBeNull();
  });
  it('ignores a stale write grant after switching conversations', async () => {
    let resolve!: (document: {
      filePath: string;
      capabilities: { canRead: boolean; canWrite: boolean };
    }) => void;
    mocks.stream.client.workbench.readFile.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { rerender } = render(ui());
    await open();
    const signal =
      mocks.stream.client.workbench.readFile.mock.calls[0][2].signal;
    mocks.stream.conversationId = 'conversation-2';
    mocks.stream.threadId = 'thread-2';
    rerender(ui(output, true, 'conversation-2'));
    await waitFor(() => expect(signal.aborted).toBe(true));
    await fixture.act(async () => {
      resolve({
        filePath: 'deliverables/交付说明.md',
        capabilities: { canRead: true, canWrite: true },
      });
    });
    expect(mocks.stream.client.workbench.downloadFile).not.toHaveBeenCalled();
    expect(
      mocks.stream.client.workbench.downloadArtifact,
    ).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('textbox', { name: 'Markdown document' }),
    ).toBeNull();
  });
  it('keeps distinct saved versions and downloads the selected original bytes', async () => {
    const first = blob('# first delivery');
    const second = blob('# second delivery');
    mocks.stream.client.workbench.downloadArtifact.mockImplementation(
      async (_id, ref) => (ref.artifactVersionId === 'v1' ? first : second),
    );
    const anchor = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const { rerender } = render(ui());
    await open();
    await screen.findByRole('heading', { name: 'first delivery' });
    const next = {
      ...output,
      resource: { ...resource, artifactVersionId: 'v2' },
    };
    rerender(ui(next));
    await open();
    expect(
      await screen.findByRole('heading', { name: 'second delivery' }),
    ).toBeVisible();
    expect(screen.getAllByRole('tab', { name: '交付说明.md' })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(anchor).toHaveBeenCalled());
    expect(URL.createObjectURL).toHaveBeenLastCalledWith(second);
    expect(
      mocks.stream.client.workbench.downloadArtifact.mock.calls.map(
        (call) => call[1].artifactVersionId,
      ),
    ).toEqual(['v1', 'v2', 'v2']);
    anchor.mockRestore();
  });

  it('checks personal workspace authority in the assistant scope and falls back to the saved version on denial', async () => {
    mocks.stream.projectId = undefined;
    mocks.stream.client.workbench.readFile.mockRejectedValue(
      new Error('Access denied'),
    );
    render(ui());
    await open();
    await screen.findByRole('heading', { name: '已保存版本' });
    expect(mocks.stream.client.workbench.readFile).toHaveBeenCalledWith(
      { kind: 'assistant', assistantId: 'agent-1' },
      output.workspacePath,
      { signal: expect.any(AbortSignal) },
    );
    expect(mocks.stream.client.workbench.saveFile).not.toHaveBeenCalled();
  });

  it.each(['unauthenticated', 'no conversation', 'no pinned version'])(
    'falls back for %s',
    async (condition) => {
      if (condition === 'unauthenticated') mocks.stream.apiKey = '';
      if (condition === 'no conversation') mocks.stream.conversationId = null;
      render(
        ui(
          condition === 'no pinned version'
            ? {
                ...output,
                resource: { type: 'artifact', artifactId: 'delivery' },
              }
            : output,
        ),
      );
      await open();
      expect(sendEvent).toHaveBeenCalledTimes(1);
      expect(
        mocks.stream.client.workbench.downloadArtifact,
      ).not.toHaveBeenCalled();
    },
  );

  it('retries failed reads with the same version and keeps the original download available', async () => {
    mocks.stream.client.workbench.downloadArtifact.mockRejectedValueOnce(
      new Error('denied'),
    );
    render(ui());
    await open();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await screen.findByRole('heading', { name: '已保存版本' });
    expect(
      mocks.stream.client.workbench.downloadArtifact.mock.calls.map(
        (call) => call[1].artifactVersionId,
      ),
    ).toEqual(['v1', 'v1']);
    expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled();
  });
  it('opens unknown formats internally with an original-file download', async () => {
    mocks.stream.client.workbench.downloadArtifact.mockResolvedValue(
      new Blob(['PK'], { type: 'application/zip' }),
    );
    render(
      ui({
        ...output,
        title: '交付说明.md',
        workspacePath: 'bundle.zip',
        mimeType: 'application/zip',
      }),
    );
    await open();
    await screen.findByText(/can be downloaded/i);
    expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled();
    expect(sendEvent).not.toHaveBeenCalled();
  });
  it('adapts delivery preview controls to theme changes', async () => {
    const { rerender } = render(
      <ThemeProvider
        theme={{ radius: 'sharp', density: 'compact', colorScheme: 'light' }}
      >
        {ui()}
      </ThemeProvider>,
    );
    await open();
    await screen.findByRole('heading', { name: '已保存版本' });
    expect(screen.getByRole('button', { name: 'Download' })).toHaveClass(
      'rounded-chat-item',
    );
    rerender(
      <ThemeProvider
        theme={{ radius: 'round', density: 'spacious', colorScheme: 'dark' }}
      >
        {ui()}
      </ThemeProvider>,
    );
    expect(screen.getByRole('button', { name: 'Download' })).toHaveClass(
      'bg-background',
    );
    expect(screen.getByRole('heading', { name: '已保存版本' })).toBeVisible();
  });
});
