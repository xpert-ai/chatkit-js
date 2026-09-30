import * as React from 'react';
import { parseDocx, repackDocx } from '@eigenpal/docx-editor-core/docx';
import type { Document } from '@eigenpal/docx-editor-core/types/document';
import {
  toProseDoc,
  updateDocumentContent,
} from '@eigenpal/docx-editor-core/prosemirror/conversion';
import {
  createDocumentContextPlugin,
  createDocumentStylesPlugin,
  ensureParaIdsInState,
} from '@eigenpal/docx-editor-core/prosemirror';
import {
  createStarterKit,
  ExtensionManager,
} from '@eigenpal/docx-editor-core/prosemirror/extensions';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { toggleMark } from 'prosemirror-commands';
import { undo, redo } from 'prosemirror-history';
import { normalizeDocxTableWidths, createDocxFile } from './docx-file.utils';
import type { BinaryEditorHandle, BinaryEditorProps } from '../file-types';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import './office.css';

const DocxEditor = React.forwardRef<BinaryEditorHandle, BinaryEditorProps>(
  function DocxEditor({ blob, name, onDirty }, ref) {
    const { t } = useChatkitTranslation();
    const host = React.useRef<HTMLDivElement>(null);
    const view = React.useRef<EditorView | null>(null);
    const documentRef = React.useRef<Document | null>(null);
    const [error, setError] = React.useState('');
    const [ready, setReady] = React.useState(false);
    React.useEffect(() => {
      let disposed = false;
      let manager: ExtensionManager | null = null;
      setReady(false);
      setError('');
      void (async () => {
        const document = normalizeDocxTableWidths(
          await parseDocx(await blob.arrayBuffer()),
        );
        if (disposed || !host.current) return;
        documentRef.current = document;
        manager = new ExtensionManager(createStarterKit());
        manager.buildSchema();
        manager.initializeRuntime();
        const styles = document.package.styles;
        const state = ensureParaIdsInState(
          EditorState.create({
            doc: toProseDoc(document, {
              styles,
              defaultTabStopTwips: document.package.settings?.defaultTabStop,
            }),
            schema: manager.getSchema(),
            plugins: [
              ...manager.getPlugins(),
              createDocumentStylesPlugin(styles),
              createDocumentContextPlugin({
                theme: document.package.theme ?? null,
                defaultTableStyleId:
                  document.package.settings?.defaultTableStyle ?? null,
              }),
            ],
          }),
        );
        view.current = new EditorView(host.current, {
          state,
          attributes: { 'aria-label': name, class: 'chatkit-docx-document' },
          dispatchTransaction: (transaction) => {
            if (!view.current || disposed) return;
            view.current.updateState(view.current.state.apply(transaction));
            if (transaction.docChanged) onDirty();
          },
        });
        setReady(true);
      })().catch((error: unknown) => {
        if (!disposed)
          setError(
            error instanceof Error
              ? error.message
              : t('workbench.files.failed'),
          );
      });
      return () => {
        disposed = true;
        view.current?.destroy();
        view.current = null;
        documentRef.current = null;
        manager?.destroy();
      };
    }, [blob, name, onDirty, t]);
    React.useImperativeHandle(
      ref,
      () => ({
        exportFile: async () => {
          if (!view.current || !documentRef.current)
            throw new Error(t('workbench.files.loading'));
          return createDocxFile(
            await repackDocx(
              updateDocumentContent(
                documentRef.current,
                view.current.state.doc,
              ),
            ),
            name,
          );
        },
      }),
      [name, t],
    );
    function command(key: string) {
      const editor = view.current;
      if (!editor) return;
      if (key === 'undo') undo(editor.state, editor.dispatch);
      else if (key === 'redo') redo(editor.state, editor.dispatch);
      else {
        const mark = editor.state.schema.marks[key];
        if (mark) toggleMark(mark)(editor.state, editor.dispatch);
      }
      editor.focus();
    }
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div
          role="toolbar"
          className="flex shrink-0 flex-wrap gap-1 border-b p-2"
        >
          {['undo', 'redo', 'bold', 'italic', 'underline'].map((key) => (
            <button
              key={key}
              type="button"
              disabled={!ready}
              className="rounded-[var(--chat-item-radius)] px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-40"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => command(key)}
            >
              {t(`workbench.files.${key}`)}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="p-4 text-sm text-destructive">
            {error}
          </p>
        )}
        {!ready && !error && (
          <p role="status" className="p-4 text-sm text-muted-foreground">
            {t('workbench.files.loading')}
          </p>
        )}
        <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-4">
          <div
            ref={host}
            className="chatkit-docx mx-auto min-h-full max-w-4xl bg-background p-8 shadow-sm"
          />
        </div>
      </div>
    );
  },
);
export default DocxEditor;
