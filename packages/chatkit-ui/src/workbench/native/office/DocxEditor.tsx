import * as React from 'react';
import {
  DocxEditor as DocumentEditor,
  type DocxEditorRef,
  useFonts,
} from '@docx-editor.dev/react';
import { packagedFonts } from '@docx-editor.dev/fonts';
import zhCN from '@docx-editor.dev/i18n/zh-CN';
import '@docx-editor.dev/core/styles/editor.css';
import './office.css';
import type { BinaryEditorHandle, BinaryEditorProps } from '../file-types';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { useTheme } from '../../../providers/Theme';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const DocxEditor = React.forwardRef<BinaryEditorHandle, BinaryEditorProps>(
  function DocxEditor({ blob, name, onDirty, onSave }, ref) {
    const { t, i18n } = useChatkitTranslation();
    const { isDarkMode } = useTheme();
    const editor = React.useRef<DocxEditorRef>(null);
    const fonts = useFonts(packagedFonts());
    const [bytes, setBytes] = React.useState<Uint8Array>();
    const [error, setError] = React.useState('');
    React.useEffect(() => {
      let disposed = false;
      setBytes(undefined);
      setError('');
      void blob.arrayBuffer().then(
        (buffer) => {
          if (!disposed) setBytes(new Uint8Array(buffer));
        },
        (error: unknown) => {
          if (!disposed)
            setError(
              error instanceof Error
                ? error.message
                : t('workbench.files.failed'),
            );
        },
      );
      return () => {
        disposed = true;
      };
    }, [blob, t]);
    React.useImperativeHandle(
      ref,
      () => ({
        exportFile: async () => {
          const buffer = await editor.current?.save();
          if (!buffer) throw new Error(t('workbench.files.loading'));
          return new Blob([buffer], { type: DOCX_MIME });
        },
      }),
      [t],
    );
    if (error)
      return (
        <p role="alert" className="p-4 text-sm text-destructive">
          {error}
        </p>
      );
    return (
      <DocumentEditor
        ref={editor}
        className="chatkit-docx h-full min-h-0"
        document={bytes}
        fonts={fonts}
        title={name}
        locale={i18n.language}
        i18n={i18n.language.startsWith('zh') ? zhCN : undefined}
        colorMode={isDarkMode ? 'dark' : 'light'}
        mode="edit"
        onChange={(change) => {
          if (!change.source) onDirty();
        }}
        onSave={onSave}
        menu={{
          reportIssue: false,
          children: (
            <DocumentEditor.Menu.File preset={false}>
              {/* The workspace owns document identity and persistence. */}
              <DocumentEditor.Menu.Save />
              <DocumentEditor.Menu.Separator />
              <DocumentEditor.Menu.PageSetup />
            </DocumentEditor.Menu.File>
          ),
        }}
      />
    );
  },
);
export default DocxEditor;
