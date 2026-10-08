import * as React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { python } from '@codemirror/lang-python';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { useTheme } from '../../providers/Theme';

export default function CodeEditor({
  value,
  onChange,
  path,
  onSave,
  readOnly = false,
}: {
  value: string;
  onChange?: (value: string) => void;
  path: string;
  onSave?: () => void;
  readOnly?: boolean;
}) {
  const { isDarkMode } = useTheme();
  const extensions = React.useMemo(() => {
    const extension = path.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return [
          javascript({
            jsx: extension.endsWith('x'),
            typescript: extension.startsWith('t'),
          }),
        ];
      case 'json':
      case 'jsonc':
        return [json()];
      case 'md':
      case 'markdown':
        return [markdown()];
      case 'html':
      case 'htm':
        return [html()];
      case 'css':
      case 'scss':
      case 'less':
        return [css()];
      case 'py':
        return [python()];
      case 'sql':
        return [sql()];
      case 'xml':
      case 'svg':
        return [xml()];
      default:
        return [];
    }
  }, [path]);
  return (
    <div
      className="h-full overflow-auto text-sm"
      onKeyDown={(event) => {
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === 's' &&
          !readOnly
        ) {
          event.preventDefault();
          onSave?.();
        }
      }}
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        editable={!readOnly}
        height="100%"
        className="h-full [&_.cm-editor]:h-full"
        extensions={extensions}
        theme={isDarkMode ? 'dark' : 'light'}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          searchKeymap: true,
          highlightActiveLine: !readOnly,
        }}
        aria-label={path}
      />
    </div>
  );
}
