import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { cleanup } from '@testing-library/react';
import { createResourceCardContent } from '@xpert-ai/chatkit-types';
import {
  fixture as f,
  setupWorkbenchTests,
} from './WorkbenchShell.test-fixture';
import { MessageResourceCards } from '../components/thread/messages/resource-cards';

setupWorkbenchTests();
beforeEach(() => {
  const files = f.mocks.stream.client.viewHosts;
  files.createFileAccessSession.mockReset();
  files.createFileAccessGrant.mockReset();
  files.readFileAccess.mockReset();
  files.revokeFileAccessSession.mockReset();
});
afterEach(() => {
  cleanup();
  f.vi.unstubAllGlobals();
});
describe('resource images in the actual Workbench shell', () => {
  it('loads inline images when Workbench navigation is disabled', async () => {
    f.vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = f.vi.fn(() => 'blob:inline');
        static revokeObjectURL = f.vi.fn();
      },
    );
    const files = f.mocks.stream.client.viewHosts;
    files.createFileAccessSession.mockResolvedValue({
      sessionId: 's',
      expiresAt: 'future',
    });
    files.createFileAccessGrant.mockResolvedValue({
      url: '/grant',
      mimeType: 'image/png',
      fileName: 'site.png',
    });
    files.readFileAccess.mockResolvedValue(
      new Blob(['pixels'], { type: 'image/png' }),
    );
    files.revokeFileAccessSession.mockResolvedValue(undefined);
    const card = createResourceCardContent({
      resource: { namespace: 'example', type: 'images', id: 'delivery' },
      title: 'Delivery',
      open: { target: 'workbench.view', viewKey: f.manifest.key },
      content: [
        {
          kind: 'image-gallery',
          images: [
            {
              id: 'site',
              title: 'Layout',
              file: {
                viewKey: f.manifest.key,
                fileKey: 'image',
                targetId: 'v1',
              },
            },
          ],
        },
      ],
    });
    const ui = f.render(
      <f.WorkbenchShell
        options={{
          ...f.baseOptions,
          workbench: {
            enabled: false,
            sideChat: { enabled: false },
            externalAssistants: { enabled: false },
          },
        }}
        locale="en-US"
        onRequestContextChange={() => undefined}
      >
        <MessageResourceCards
          message={{ id: 'reply', type: 'assistant', content: [card] }}
        />
      </f.WorkbenchShell>,
    );
    expect(await f.screen.findByRole('img', { name: 'Layout' })).toBeVisible();
    expect(
      f.screen.getByRole('button', { name: 'Open Delivery' }),
    ).toBeDisabled();
    expect(files.readFileAccess).toHaveBeenCalledOnce();
    ui.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:inline');
  });

  it('composes an image preview, summary and authorized file download', async () => {
    let count = 0;
    f.vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = f.vi.fn(() => `blob:image-${++count}`);
        static revokeObjectURL = f.vi.fn();
      },
    );
    f.mocks.listSlotViews.mockResolvedValue([f.manifest]);
    const files = f.mocks.stream.client.viewHosts;
    files.createFileAccessSession.mockResolvedValue({
      sessionId: 's',
      expiresAt: 'future',
    });
    files.createFileAccessGrant.mockResolvedValue({
      url: '/grant',
      mimeType: 'image/png',
      fileName: 'site.png',
    });
    files.readFileAccess.mockResolvedValue(
      new Blob(['pixels'], { type: 'image/png' }),
    );
    files.revokeFileAccessSession.mockResolvedValue(undefined);
    const card = createResourceCardContent({
      resource: { namespace: 'bid', type: 'images', id: 'task' },
      title: '施工配图',
      content: [
        { kind: 'fields', fields: [{ label: '状态', value: '已验收' }] },
        {
          kind: 'image-gallery',
          images: [
            {
              id: 'site',
              title: '施工平面图',
              file: {
                viewKey: f.manifest.key,
                fileKey: 'image',
                targetId: 'p:v',
              },
            },
          ],
        },
        {
          kind: 'file-list',
          files: [
            {
              id: 'report',
              title: '施工说明',
              file: {
                viewKey: f.manifest.key,
                fileKey: 'report',
                targetId: 'p:v',
              },
            },
          ],
        },
      ],
      open: { target: 'workbench.view', viewKey: f.manifest.key },
    });
    const ui = f.render(
      <f.WorkbenchShell
        options={{ ...f.baseOptions, workbench: { enabled: true } }}
        locale="zh-CN"
        onRequestContextChange={() => undefined}
      >
        <MessageResourceCards
          message={{ id: 'reply', type: 'assistant', content: [card] }}
        />
      </f.WorkbenchShell>,
    );
    const thumbnail = await f.screen.findByRole('img', { name: '施工平面图' });
    f.fireEvent.click(thumbnail);
    await f.waitFor(() =>
      expect(f.screen.getAllByRole('img', { name: '施工平面图' })).toHaveLength(
        2,
      ),
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
    expect(files.readFileAccess).toHaveBeenCalledTimes(2);
    expect(f.screen.getByText('已验收')).toBeVisible();
    files.createFileAccessGrant.mockResolvedValueOnce({
      url: '/report-grant',
      mimeType: 'application/pdf',
      fileName: '施工说明.pdf',
    });
    const downloadedNames: string[] = [];
    const click = f.vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadedNames.push(this.download);
      });
    // Images opened from galleries use the same file tab/download capability.
    files.createFileAccessGrant.mockReset().mockResolvedValue({
      url: '/image-original',
      mimeType: 'image/png',
      fileName: 'site.png',
    });
    f.fireEvent.click(
      f.screen.getByRole('button', { name: /^(下载|Download)$/ }),
    );
    await f.waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(files.createFileAccessGrant).toHaveBeenLastCalledWith(
      's',
      { fileKey: 'image', targetId: 'p:v', purpose: 'download' },
      expect.anything(),
    );
    files.createFileAccessGrant.mockResolvedValueOnce({
      url: '/report-grant',
      mimeType: 'application/pdf',
      fileName: '施工说明.pdf',
    });
    f.fireEvent.click(f.screen.getByRole('button', { name: /施工说明/ }));
    await f.waitFor(() => expect(click).toHaveBeenCalledTimes(2));
    expect(files.createFileAccessGrant).toHaveBeenLastCalledWith(
      's',
      {
        fileKey: 'report',
        targetId: 'p:v',
        purpose: 'download',
      },
      expect.anything(),
    );
    expect(downloadedNames).toEqual(['site.png', '施工说明.pdf']);
    click.mockRestore();
    ui.unmount();
  });
});
