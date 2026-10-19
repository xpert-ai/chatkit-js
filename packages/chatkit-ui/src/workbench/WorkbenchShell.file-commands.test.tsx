import { afterEach, describe, expect, it } from 'vitest';
import { cleanup } from '@testing-library/react';
import {
  fixture as f,
  setupWorkbenchTests,
} from './WorkbenchShell.test-fixture';

setupWorkbenchTests();
afterEach(() => {
  cleanup();
  f.vi.unstubAllGlobals();
  f.vi.restoreAllMocks();
});

describe('remote View resource file commands', () => {
  it('opens the shared PDF viewer, downloads the separately authorized original and releases its Blob URL', async () => {
    let count = 0;
    f.vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = f.vi.fn(() => `blob:command-${++count}`);
        static revokeObjectURL = f.vi.fn();
      },
    );
    f.mocks.listSlotViews.mockResolvedValue([f.manifest]);
    const files = f.mocks.stream.client.viewHosts;
    files.createFileAccessSession.mockResolvedValue({
      sessionId: 's',
      expiresAt: '2099-01-01T00:00:00Z',
    });
    files.createFileAccessGrant.mockResolvedValue({
      url: '/preview',
      expiresAt: '2099-01-01T00:00:00Z',
      mimeType: 'application/pdf',
      fileName: 'Manual.pdf',
    });
    const pdf = await new Response('%PDF-1.7\n%%EOF', {
      headers: { 'Content-Type': 'application/pdf' },
    }).blob();
    files.readFileAccess.mockResolvedValue(pdf);
    files.revokeFileAccessSession.mockResolvedValue(undefined);
    const onClientCommand = f.vi.fn();
    const ui = f.render(
      <f.WorkbenchShell
        options={{
          ...f.baseOptions,
          workbench: { enabled: true, onClientCommand },
        }}
        locale="en-US"
        onRequestContextChange={() => undefined}
      >
        <f.WorkbenchToggleButton />
      </f.WorkbenchShell>,
    );
    f.setObservedWidth(1200);
    await f.waitFor(() =>
      expect(f.screen.getByLabelText('Open views')).toBeEnabled(),
    );
    f.fireEvent.click(f.screen.getByLabelText('Open views'));
    await f.screen.findByTestId('remote-view');
    const remoteView = f.mocks.remoteViewProps;
    if (!remoteView) throw new Error('Expected initialized View');
    await f.act(async () => {
      expect(
        await remoteView.onClientCommand(
          'workbench.file.open',
          { resource: { fileKey: 'manual', targetId: 'v1' } },
          f.manifest,
        ),
      ).toMatchObject({ success: true });
    });
    expect(
      await f.screen.findByRole('tab', { name: 'Manual.pdf' }),
    ).toBeVisible();
    await f.waitFor(() =>
      expect(
        f.screen
          .getAllByTitle('Manual.pdf')
          .find((node) => node.tagName === 'IFRAME'),
      ).toHaveAttribute('src', 'blob:command-1'),
    );
    expect(files.createFileAccessSession).toHaveBeenCalledWith(
      'agent',
      'agent-1',
      f.manifest.key,
      expect.objectContaining({
        runtimeScope: {
          projectId: 'project-1',
          conversationId: 'conversation-1',
        },
      }),
    );
    expect(onClientCommand).not.toHaveBeenCalled();
    const clicked = f.vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    f.fireEvent.click(f.screen.getByRole('button', { name: 'Download' }));
    await f.waitFor(() => expect(clicked).toHaveBeenCalledOnce());
    expect(
      files.createFileAccessGrant.mock.calls.map((call) => call[1].purpose),
    ).toEqual(['preview', 'download']);
    expect(files.revokeFileAccessSession).toHaveBeenCalledTimes(2);
    const original = f.vi.mocked(URL.createObjectURL).mock.calls.at(-1)?.[0];
    if (!original || !('arrayBuffer' in original))
      throw new Error('Expected file bytes');
    expect(Array.from(new Uint8Array(await original.arrayBuffer()))).toEqual(
      Array.from(new Uint8Array(await pdf.arrayBuffer())),
    );
    ui.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:command-1');
  });
});
