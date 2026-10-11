import * as React from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableCell, TableHeader, TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Bold, Italic, List, ListOrdered, Redo2, Undo2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import '../file-preview/file-preview.css';
import './markdown-editor.css';

const extensions = [
  StarterKit.configure({
    underline: false,
    link: { openOnClick: false, autolink: false },
  }),
  TableKit.configure({
    table: { resizable: false },
    tableCell: false,
    tableHeader: false,
  }),
  TableCell.extend({ content: 'paragraph' }),
  TableHeader.extend({ content: 'paragraph' }),
  Image,
  TaskList,
  TaskItem.configure({ nested: true }),
  Markdown.configure({ markedOptions: { gfm: true } }),
];

/** Markdown remains the persisted format. Loading, permission changes and save echoes never dirty a file. */
export default function MarkdownEditor({
  value,
  onChange,
  readOnly = true,
}: {
  value: string;
  onChange?: (markdown: string) => void;
  readOnly?: boolean;
}) {
  const { t } = useChatkitTranslation();
  const current = React.useRef(value);
  const update = React.useRef(onChange);
  update.current = onChange;
  const writable = React.useRef(!readOnly);
  writable.current = !readOnly;
  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: value,
    contentType: 'markdown',
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'workspace-markdown markdown-editor-content outline-none',
        role: 'textbox',
        'aria-label': t('workbench.markdown.document'),
        'aria-multiline': 'true',
        'aria-readonly': String(readOnly),
      },
    },
    onUpdate: ({ editor }) => {
      if (!writable.current) return;
      current.current = editor.getMarkdown();
      update.current?.(current.current);
    },
  });
  React.useEffect(() => {
    if (!editor || current.current === value) return;
    current.current = value;
    editor.commands.setContent(value, {
      contentType: 'markdown',
      emitUpdate: false,
    });
  }, [editor, value]);
  React.useEffect(() => {
    editor?.setEditable(!readOnly, false);
  }, [editor, readOnly]);
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            bold: editor.isActive('bold'),
            italic: editor.isActive('italic'),
            bullets: editor.isActive('bulletList'),
            numbers: editor.isActive('orderedList'),
            undo: editor.can().undo(),
            redo: editor.can().redo(),
            heading:
              [1, 2, 3, 4, 5, 6].find((level) =>
                editor.isActive('heading', { level }),
              ) ?? 0,
          }
        : null,
  });
  const buttons = [
    {
      name: 'bold',
      Icon: Bold,
      active: state?.bold,
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      name: 'italic',
      Icon: Italic,
      active: state?.italic,
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      name: 'bullets',
      Icon: List,
      active: state?.bullets,
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      name: 'numbers',
      Icon: ListOrdered,
      active: state?.numbers,
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      name: 'undo',
      Icon: Undo2,
      disabled: !state?.undo,
      run: () => editor?.chain().focus().undo().run(),
    },
    {
      name: 'redo',
      Icon: Redo2,
      disabled: !state?.redo,
      run: () => editor?.chain().focus().redo().run(),
    },
  ];
  return (
    <div className="markdown-editor flex h-full min-h-0 flex-col bg-background text-foreground">
      {!readOnly && (
        <div
          role="toolbar"
          aria-label={t('workbench.markdown.toolbar')}
          className="file-preview-toolbar flex shrink-0 flex-wrap items-center border-b"
        >
          <select
            className="rounded-chat-item border bg-background text-foreground"
            aria-label={t('workbench.markdown.block')}
            value={state?.heading ?? 0}
            disabled={!editor}
            onChange={(event) => {
              const level = ([1, 2, 3, 4, 5, 6] as const).find(
                (level) => String(level) === event.target.value,
              );
              if (level) editor?.chain().focus().setHeading({ level }).run();
              else editor?.chain().focus().setParagraph().run();
            }}
          >
            <option value="0">{t('workbench.markdown.paragraph')}</option>
            {[1, 2, 3, 4, 5, 6].map((level) => (
              <option key={level} value={level}>
                {t('workbench.markdown.heading', { level })}
              </option>
            ))}
          </select>
          {buttons.map(({ name, Icon, active, disabled, run }) => (
            <Button
              key={name}
              size="sm"
              variant={active ? 'secondary' : 'ghost'}
              className="rounded-chat-item"
              aria-label={t(`workbench.markdown.${name}`)}
              title={t(`workbench.markdown.${name}`)}
              aria-pressed={active}
              disabled={!editor || disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={run}
            >
              <Icon className="size-4" />
            </Button>
          ))}
        </div>
      )}
      <EditorContent editor={editor} className="min-h-0 flex-1 overflow-auto" />
    </div>
  );
}
