import { Blob as NodeBlob } from 'node:buffer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageFileActivity } from '../../components/task-summary/FileActivity';
import { setupWorkbenchTests, fixture } from '../WorkbenchShell.test-fixture';
import {
  createHtmlArtifactPreview,
  prepareHtmlPreview,
} from './html-artifact-preview';

vi.mock('../code-editor/CodeEditor', () => ({
  default: ({ value, readOnly }: { value: string; readOnly: boolean }) => (
    <textarea aria-label="HTML source" value={value} readOnly={readOnly} />
  ),
}));

const {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  mocks,
  WorkbenchShell,
  useWorkbench,
  baseOptions,
  setObservedWidth,
} = fixture;
const resource = {
  type: 'artifact' as const,
  artifactId: 'page',
  artifactVersionId: 'v1',
};
const html =
  '<!doctype html><html><head><title>Game</title></head><body><button id="play">Play</button><script>document.body.dataset.ready="true"</script></body></html>';
const response = () => new Blob([html], { type: 'text/html' });

function Launchers() {
  const workbench = useWorkbench();
  return (
    <>
      <MessageFileActivity
        message={{
          id: 'message',
          content: '',
          taskSummary: {
            version: 1,
            outputs: [
              {
                id: 'html',
                kind: 'file',
                title: 'index.html',
                mimeType: 'text/html',
                origin: 'tool',
                resource,
              },
            ],
          },
        }}
      />
      <button
        onClick={() =>
          workbench.openHtmlArtifact?.(
            { ...resource, artifactVersionId: 'v2' },
            'index.html v2',
          )
        }
      >
        Open next version
      </button>
    </>
  );
}

describe('saved HTML delivery', () => {
  setupWorkbenchTests();
  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob);
    URL.createObjectURL = vi.fn(() => 'blob:download');
    URL.revokeObjectURL = vi.fn();
    mocks.listSlotViews.mockResolvedValue([]);
    mocks.stream.client.workbench.downloadArtifact.mockReset();
  });

  const onRequestContextChange = vi.fn();
  const ui = () => (
    <WorkbenchShell
      options={{
        ...baseOptions,
        workbench: { enabled: true },
      }}
      locale="en-US"
      onRequestContextChange={onRequestContextChange}
    >
      <Launchers />
    </WorkbenchShell>
  );

  it('opens the delivered version as a Workbench webpage with source, download and snapshot refresh', async () => {
    const command =
      mocks.stream.client.workbench.downloadArtifact.mockResolvedValue(
        response(),
      );
    const { container, rerender, unmount } = render(ui());
    setObservedWidth(1200);
    fireEvent.click(
      await screen.findByRole('button', { name: /Open index.html/ }),
    );
    const frame = await waitFor(() => {
      const element = container.querySelector('iframe[title="index.html"]');
      expect(element).not.toBeNull();
      return element!;
    });
    expect(
      await screen.findByRole('tab', { name: 'index.html' }),
    ).toBeInTheDocument();
    expect(command).toHaveBeenCalledWith(
      'conversation-1',
      { artifactId: 'page', artifactVersionId: 'v1' },
      { signal: expect.any(AbortSignal) },
    );
    expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
    expect(frame.getAttribute('srcdoc')).toContain(
      'document.body.dataset.ready',
    );
    expect(frame.getAttribute('srcdoc')).toContain("connect-src 'none'");
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'download',
      'index.html',
    );

    // Streaming rerenders preserve the frame and avoid repeated downloads.
    rerender(ui());
    expect(container.querySelector('iframe[title="index.html"]')).toBe(frame);
    expect(command).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(container.querySelector('iframe[title="index.html"]')).not.toBe(
      frame,
    );
    expect(command).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'View source' }));
    expect(await screen.findByLabelText('HTML source')).toHaveValue(html);
    expect(screen.getByLabelText('HTML source')).toHaveAttribute('readonly');

    fireEvent.click(
      await screen.findByRole('button', { name: /Open index.html/ }),
    );
    expect(screen.getAllByRole('tab', { name: 'index.html' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Open next version' }));
    expect(
      await screen.findByRole('tab', { name: 'index.html v2' }),
    ).toBeInTheDocument();
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:download');
  });

  it('adds preview annotations to the local composer without a Desktop host command', async () => {
    mocks.stream.client.workbench.downloadArtifact.mockResolvedValue(
      response(),
    );
    const { container } = render(ui());
    setObservedWidth(1200);
    fireEvent.click(
      await screen.findByRole('button', { name: /Open index.html/ }),
    );
    await screen.findByRole('link', { name: 'Download' });
    const frame = container.querySelector('iframe')!;
    const session = frame.srcdoc.match(
      /[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}/i,
    )![0];
    const emit = (event: object) =>
      act(() =>
        window.dispatchEvent(
          new MessageEvent('message', {
            source: frame.contentWindow,
            data: { channel: 'chatkit:html-preview', session, event },
          }),
        ),
      );
    emit({ type: 'ready' });
    fireEvent.click(screen.getByRole('button', { name: 'Annotate page' }));
    emit({
      type: 'selected',
      element: {
        selector: '#play',
        tag: 'button',
        text: 'Play',
        html: '<button>Play</button>',
        styles: [],
      },
    });
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Make this larger' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add to chat' }));
    await waitFor(() =>
      expect(mocks.updateComposer).toHaveBeenCalledWith({
        appendReferences: true,
        references: [
          expect.objectContaining({
            type: 'quote',
            text: expect.stringContaining('Make this larger'),
          }),
        ],
      }),
    );
    expect(mocks.focusComposer).toHaveBeenCalledOnce();
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it('shows authorization failures and retries the same version', async () => {
    const command = mocks.stream.client.workbench.downloadArtifact
      .mockRejectedValueOnce(new Error('File access denied'))
      .mockResolvedValue(response());
    render(ui());
    setObservedWidth(1200);
    fireEvent.click(
      await screen.findByRole('button', { name: /Open index.html/ }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'File access denied',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByRole('link', { name: 'Download' }),
    ).toBeInTheDocument();
    expect(command.mock.calls[0].slice(0, 2)).toEqual(
      command.mock.calls[1].slice(0, 2),
    );
  });

  it('discards late HTML after the conversation changes', async () => {
    let complete!: (value: unknown) => void;
    const command =
      mocks.stream.client.workbench.downloadArtifact.mockImplementation(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          }),
      );
    const { container, rerender } = render(ui());
    setObservedWidth(1200);
    fireEvent.click(
      await screen.findByRole('button', { name: /Open index.html/ }),
    );
    await waitFor(() => expect(command).toHaveBeenCalledOnce());
    mocks.stream.conversationId = 'another-conversation';
    rerender(ui());
    await act(async () => {
      complete(response());
    });
    expect(container.querySelector('iframe[title="index.html"]')).toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('validates MIME and size instead of inferring HTML from the name', async () => {
    for (const blob of [
      new Blob([html], { type: 'text/plain' }),
      new Blob([], { type: 'text/html' }),
    ]) {
      const preview = createHtmlArtifactPreview(
        resource,
        'index.html',
        async () => blob,
        'Unavailable',
      );
      await expect(
        preview.html!.load(new AbortController().signal),
      ).rejects.toThrow();
    }
  });

  it('isolates scripts and flags separate resources without rewriting them to current workspace files', () => {
    const standalone = prepareHtmlPreview(html);
    expect(standalone.hasExternalResources).toBe(false);
    const separate = prepareHtmlPreview(
      '<head><base href="https://platform.test"><meta http-equiv="refresh" content="0; url=https://platform.test"><link rel="stylesheet" href="styles.css"></head><body><script src="app.js"></script></body>',
    );
    const document = new DOMParser().parseFromString(
      separate.srcDoc,
      'text/html',
    );
    expect(
      document.querySelector('base, meta[http-equiv="refresh"]'),
    ).toBeNull();
    expect(document.head.firstElementChild?.getAttribute('http-equiv')).toBe(
      'Content-Security-Policy',
    );
    expect(document.querySelector('script')?.getAttribute('src')).toBe(
      'app.js',
    );
    expect(separate.hasExternalResources).toBe(true);
  });
});
