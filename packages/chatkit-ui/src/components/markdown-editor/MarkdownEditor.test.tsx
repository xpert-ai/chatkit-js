import * as React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/core';
import MarkdownEditor from './MarkdownEditor';
import { initI18n } from '../../i18n';

beforeEach(async () => {
  await initI18n().changeLanguage('en-US');
});
afterEach(cleanup);
const markdown =
  '# 中文标题\n\n正文 **加粗** 与 [链接](https://example.test)\n\n- 列表\n\n- [x] 已完成\n\n| 项目 | 状态 |\n| --- | --- |\n| 施工 | 完成 |\n\n```js\nconst n = 1\n```\n\n![图示](https://example.test/image.png)';
async function editor() {
  const node = await screen.findByRole('textbox', {
    name: 'Markdown document',
  });
  return (node as HTMLElement & { editor: Editor }).editor;
}
it('renders real Markdown as rich content and serializes formatting, tables, tasks, code and images after an edit', async () => {
  const change = vi.fn();
  render(
    <MarkdownEditor value={markdown} readOnly={false} onChange={change} />,
  );
  const current = await editor();
  expect(screen.getByRole('heading', { name: '中文标题' })).toBeVisible();
  expect(screen.getByRole('table')).toHaveTextContent('施工');
  expect(change).not.toHaveBeenCalled();
  act(() => {
    current.commands.insertContentAt(
      current.state.doc.content.size,
      '<p>追加内容</p>',
    );
  });
  await waitFor(() => expect(change).toHaveBeenCalled());
  const saved = change.mock.lastCall?.[0];
  for (const content of [
    '# 中文标题',
    '**加粗**',
    '[链接](https://example.test)',
    '- [x] 已完成',
    '| 施工',
    'const n = 1',
    '![图示](https://example.test/image.png)',
    '追加内容',
  ])
    expect(saved).toContain(content);
});
it('stays read-only without formatting controls and never emits edits on permission changes', async () => {
  const change = vi.fn();
  const { rerender } = render(
    <MarkdownEditor value={markdown} readOnly onChange={change} />,
  );
  await editor();
  expect(screen.getByRole('textbox')).toHaveAttribute(
    'contenteditable',
    'false',
  );
  expect(screen.queryByRole('toolbar')).toBeNull();
  rerender(
    <MarkdownEditor value={markdown} readOnly={false} onChange={change} />,
  );
  await waitFor(() =>
    expect(screen.getByRole('textbox')).toHaveAttribute(
      'contenteditable',
      'true',
    ),
  );
  rerender(<MarkdownEditor value={markdown} readOnly onChange={change} />);
  await waitFor(() =>
    expect(screen.getByRole('textbox')).toHaveAttribute(
      'contenteditable',
      'false',
    ),
  );
  expect(change).not.toHaveBeenCalled();
});
it('accepts external file changes without an edit event and preserves undo history on echoed changes', async () => {
  const change = vi.fn();
  const { rerender } = render(
    <MarkdownEditor value="# original" readOnly={false} onChange={change} />,
  );
  const current = await editor();
  rerender(
    <MarkdownEditor value="# refreshed" readOnly={false} onChange={change} />,
  );
  await screen.findByRole('heading', { name: 'refreshed' });
  expect(change).not.toHaveBeenCalled();
  act(() => {
    current.commands.insertContentAt(
      current.state.doc.content.size,
      '<p>new paragraph</p>',
    );
  });
  const updated = change.mock.lastCall?.[0];
  rerender(
    <MarkdownEditor value={updated} readOnly={false} onChange={change} />,
  );
  expect(current.can().undo()).toBe(true);
  act(() => {
    current.commands.undo();
  });
  expect(current.getText()).not.toContain('new paragraph');
});
