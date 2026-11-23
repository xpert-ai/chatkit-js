import * as React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTPError } from '@xpert-ai/xpert-sdk';
import i18next from 'i18next';
import { initI18n } from '../../i18n';
import { ChatAttachments, type ChatAttachmentsHandle } from './attachments';
import type { AgentFile } from '../../lib/types';

const ready: AgentFile = {
  id: 'asset',
  fileId: 'asset',
  storageFileId: 'stored',
  status: 'ready',
  parseStatus: 'ready',
};

function setup(
  uploadFile = vi.fn().mockResolvedValue(ready),
  getFileStatus = vi.fn().mockResolvedValue(ready),
) {
  const ref = React.createRef<ChatAttachmentsHandle>();
  render(
    <ChatAttachments
      ref={ref}
      retryUploadLabel="重新上传"
      uploadFile={uploadFile}
      deleteFile={vi.fn()}
      getFileStatus={getFileStatus}
    />,
  );
  return { ref, uploadFile };
}
async function queue(ref: React.RefObject<ChatAttachmentsHandle | null>) {
  await act(async () => {
    ref.current?.queueFiles([
      new File(['tender'], '招标文件.doc', { type: 'application/msword' }),
    ]);
  });
}
beforeEach(async () => {
  initI18n();
  await i18next.changeLanguage('zh-CN');
});

describe('attachment failure explanations', () => {
  it('shows localized quota reason inline, and clears it when retry succeeds', async () => {
    const uploadFile = vi
      .fn()
      .mockRejectedValueOnce(
        new HTTPError(
          413,
          JSON.stringify({
            code: 'application_storage_limit',
            message: 'Storage is full.',
          }),
        ),
      )
      .mockResolvedValueOnce(ready);
    const { ref } = setup(uploadFile);
    await queue(ref);
    expect(await screen.findByRole('alert')).toHaveTextContent('存储空间已满');
    expect(screen.getByRole('alert')).not.toHaveTextContent(
      'APP_PLATFORM_FAILURE',
    );
    fireEvent.click(screen.getByRole('button', { name: '重新上传' }));
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    );
    expect(uploadFile).toHaveBeenCalledTimes(2);
    expect(screen.getByTitle('招标文件.doc')).toBeInTheDocument();
  });
  it('displays the server validation message and supports legacy quota responses', async () => {
    const { ref } = setup(
      vi
        .fn()
        .mockRejectedValue(
          new HTTPError(400, JSON.stringify({ message: '文件格式不支持' })),
        ),
    );
    await queue(ref);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '文件格式不支持',
    );
  });
  it('does not render HTML returned by a proxy', async () => {
    const { ref } = setup(
      vi
        .fn()
        .mockRejectedValue(
          new HTTPError(502, '<html>upstream internal diagnostic</html>'),
        ),
    );
    await queue(ref);
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 502');
    expect(screen.getByRole('alert')).not.toHaveTextContent('upstream');
  });
  it('shows a parse failure reason after polling', async () => {
    const { ref } = setup(
      vi
        .fn()
        .mockResolvedValue({
          ...ready,
          status: 'parsing',
          parseStatus: 'parsing',
        }),
      vi
        .fn()
        .mockResolvedValue({
          ...ready,
          status: 'failed',
          parseStatus: 'failed',
          error: '文档已加密，无法解析',
        }),
    );
    await queue(ref);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '文档已加密，无法解析',
    );
  });
});
