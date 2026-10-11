import * as React from 'react';
import { Blob as NodeBlob } from 'node:buffer';
import type { Editor } from '@tiptap/core';
import { Client } from '@xpert-ai/xpert-sdk';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initI18n } from '../../../i18n';
import { WorkspaceFileEditor } from './WorkspaceFileEditor';

beforeEach(async () => {
  await initI18n().changeLanguage('en-US');
  vi.stubGlobal('Blob', NodeBlob);
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function setup(canWrite: boolean | undefined) {
  const client = new Client({ apiUrl: 'https://example.test/api/ai' });
  const document = {
    filePath: 'report.md',
    ...(canWrite === undefined
      ? {}
      : { capabilities: { canRead: true, canWrite } }),
  };
  const read = vi
    .spyOn(client.workbench, 'readFile')
    .mockResolvedValue(document);
  const download = vi
    .spyOn(client.workbench, 'downloadFile')
    .mockResolvedValue(new Blob(['# 原始标题\n\n正文']));
  const save = vi
    .spyOn(client.workbench, 'saveFile')
    .mockResolvedValue(document);
  const register = vi.fn();
  const onSaved = vi.fn();
  render(
    <WorkspaceFileEditor
      client={client}
      scope={{ kind: 'conversation', conversationId: 'conversation' }}
      file={document}
      tabKey="file"
      register={register}
      onSaved={onSaved}
    />,
  );
  return { client, read, download, save, register, onSaved };
}
async function edit() {
  const node = await screen.findByRole('textbox', {
    name: 'Markdown document',
  });
  const editor = (node as HTMLElement & { editor: Editor }).editor;
  act(() => {
    editor.commands.insertContentAt(
      editor.state.doc.content.size,
      '<p>用户新增内容</p>',
    );
  });
  return node;
}
it('opens directly in Tiptap, keeps opening clean, and saves Markdown after rechecking permission', async () => {
  const { read, save, register, onSaved } = setup(true);
  await screen.findByRole('textbox');
  expect(screen.getByRole('heading', { name: '原始标题' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  expect(register.mock.lastCall?.[1].dirty).toBe(false);
  await edit();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(read).toHaveBeenCalledTimes(2);
  expect(save).toHaveBeenCalledWith(
    { kind: 'conversation', conversationId: 'conversation' },
    'report.md',
    expect.stringContaining('用户新增内容'),
    { signal: expect.any(AbortSignal) },
  );
  expect(save.mock.calls[0][2]).toContain('# 原始标题');
});
it.each([false, undefined])(
  'displays read-only Markdown for denied or unknown authority: %s',
  async (canWrite) => {
    const { save } = setup(canWrite);
    const node = await screen.findByRole('textbox');
    expect(node).toHaveAttribute('contenteditable', 'false');
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('toolbar')).toBeNull();
    fireEvent.keyDown(node, { key: 's', ctrlKey: true });
    expect(save).not.toHaveBeenCalled();
  },
);
it('preserves the draft and disables editing when permission is revoked before save', async () => {
  const { read, save, register } = setup(true);
  const node = await edit();
  const readonly = {
    filePath: 'report.md',
    capabilities: { canRead: true, canWrite: false },
  };
  read.mockResolvedValue(readonly);
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Read only');
  expect(node).toHaveTextContent('用户新增内容');
  expect(node).toHaveAttribute('contenteditable', 'false');
  expect(register.mock.lastCall?.[1].dirty).toBe(true);
  expect(save).not.toHaveBeenCalled();
});
it('preserves the rich draft on a content conflict', async () => {
  const { download, save } = setup(true);
  const node = await edit();
  download.mockResolvedValue(new Blob(['# 其他用户更新']));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'changed elsewhere',
  );
  expect(node).toHaveTextContent('用户新增内容');
  expect(save).not.toHaveBeenCalled();
});
