import { describe, it, afterEach, expect } from 'vitest';
import { cleanup } from '@testing-library/react';
import { createResourceCardContent } from '@xpert-ai/chatkit-types';
import {
  fixture as f,
  setupWorkbenchTests,
} from './WorkbenchShell.test-fixture';
import { MessageResourceCards } from '../components/thread/messages/resource-cards';

setupWorkbenchTests();
afterEach(() => {
  cleanup();
  f.vi.useRealTimers();
  f.vi.unstubAllGlobals();
  f.vi.restoreAllMocks();
});
describe('export resource files in Workbench', () => {
  it('opens a file tab, previews the PDF, and downloads a large original without opening Bid', async () => {
    let count = 0;
    f.vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = f.vi.fn(() => `blob:file-${++count}`);
        static revokeObjectURL = f.vi.fn();
      },
    );
    f.mocks.listSlotViews.mockResolvedValue([f.manifest]);
    const files = f.mocks.stream.client.viewHosts;
    files.createFileAccessSession.mockResolvedValue({
      sessionId: 's',
      expiresAt: 'future',
    });
    files.createFileAccessGrant.mockResolvedValueOnce({
      url: '/preview',
      mimeType: 'application/pdf',
      fileName: '标书.pdf',
      size: 512,
    });
    files.readFileAccess.mockResolvedValue(
      new Blob(['%PDF preview'], { type: 'application/octet-stream' }),
    );
    files.revokeFileAccessSession.mockResolvedValue(undefined);
    const card = createResourceCardContent({
      resource: { namespace: 'bid', type: 'export', id: 'v1' },
      title: '标书.docx',
      open: {
        target: 'workbench.file',
        viewKey: f.manifest.key,
        fileKey: 'export',
        targetId: 'v1',
        previewFile: {
          viewKey: f.manifest.key,
          fileKey: 'pdf',
          targetId: 'v1',
        },
      },
    });
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
        <MessageResourceCards
          message={{ id: 'reply', type: 'assistant', content: [card] }}
        />
      </f.WorkbenchShell>,
    );
    const open = await f.screen.findByRole('button', {
      name: /Open 标书.docx/,
    });
    await f.waitFor(() => expect(open).toBeEnabled());
    expect(files.createFileAccessSession).not.toHaveBeenCalled();
    f.fireEvent.click(open);
    await f.waitFor(() =>
      expect(
        f.screen
          .getAllByTitle('标书.docx')
          .find((node) => node.tagName === 'IFRAME'),
      ).toHaveAttribute('src', 'blob:file-1'),
    );
    expect(f.screen.getByRole('tab', { name: '标书.docx' })).toBeVisible();
    expect(onClientCommand).not.toHaveBeenCalled();
    expect(files.createFileAccessGrant).toHaveBeenCalledWith(
      's',
      { fileKey: 'pdf', targetId: 'v1', purpose: 'preview' },
      expect.objectContaining({
        runtimeScope: {
          projectId: 'project-1',
          conversationId: 'conversation-1',
        },
      }),
    );
    files.createFileAccessGrant.mockResolvedValueOnce({
      url: '/original',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileName: '标书.docx',
      size: 289 * 1024 * 1024,
    });
    const original = new Blob(['original document bytes']);
    files.readFileAccess.mockResolvedValueOnce(original);
    const names: string[] = [];
    const click = f.vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        names.push(this.download);
      });
    f.vi.useFakeTimers({ toFake: ['setTimeout'] });
    await f.act(async () => {
      f.fireEvent.click(f.screen.getByRole('button', { name: 'Download' }));
      await f.vi.waitFor(() => expect(click).toHaveBeenCalledOnce());
    });
    expect(names).toEqual(['标书.docx']);
    expect(files.createFileAccessGrant).toHaveBeenLastCalledWith(
      's',
      { fileKey: 'export', targetId: 'v1', purpose: 'download' },
      expect.anything(),
    );
    const downloaded = f.vi.mocked(URL.createObjectURL).mock.calls.at(-1)![0];
    expect(downloaded).toBeInstanceOf(Blob);
    if (!(downloaded instanceof Blob))
      throw new Error('Expected original file bytes');
    expect(await downloaded.arrayBuffer()).toEqual(
      await original.arrayBuffer(),
    );
    expect(files.revokeFileAccessSession).toHaveBeenCalledTimes(2);
    ui.unmount();
    f.vi.advanceTimersByTime(1000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:file-1');
  });
});
