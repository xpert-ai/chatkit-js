import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

const CodeEditor = React.lazy(() => import('../code-editor/CodeEditor'));
export function canRenderReviewFile(path: string) {
  return /\.(html?|svg|md|markdown)$/i.test(path);
}
export function ReviewFileContent({
  path,
  text,
  preview = false,
}: {
  path: string;
  text: string;
  preview?: boolean;
}) {
  const { t } = useChatkitTranslation();
  if (preview && /\.(md|markdown)$/i.test(path))
    return (
      <div className="review-markdown p-6 text-sm">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          skipHtml
          components={{
            img: ({ alt }) => (
              <span className="text-muted-foreground">{alt}</span>
            ),
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
    );
  if (preview && /\.(html?|svg)$/i.test(path))
    return (
      <iframe
        title={path}
        className="h-96 w-full border-0 bg-white"
        sandbox=""
        referrerPolicy="no-referrer"
        srcDoc={`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; form-action 'none'; base-uri 'none'">${text}`}
      />
    );
  return (
    <React.Suspense
      fallback={<p className="p-4 text-sm">{t('workbench.loading')}</p>}
    >
      <CodeEditor path={path} value={text} readOnly />
    </React.Suspense>
  );
}
