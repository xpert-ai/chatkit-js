import * as React from 'react';
import type {
  ResourceCardContent,
  ResourceCardFile,
} from '@xpert-ai/chatkit-types';
import { Download, File, Loader2 } from 'lucide-react';
import { useResourceCardActions } from '../../../../resource-cards/context';
import { useChatkitTranslation } from '../../../../i18n/useChatkitTranslation';
import { ResourceCardImages } from './images';

function FileItem({ file }: { file: ResourceCardFile }) {
  const { downloadResourceCardFile } = useResourceCardActions();
  const { t } = useChatkitTranslation();
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const pending = React.useRef(false);
  const download = async () => {
    if (!downloadResourceCardFile || pending.current) return;
    pending.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await downloadResourceCardFile(file);
    } catch {
      setFailed(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <li className="py-2">
      <div className="flex items-center gap-2">
        <File
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium">{file.title}</p>
          {file.description && (
            <p className="break-words text-xs text-muted-foreground">
              {file.description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void download()}
          disabled={!downloadResourceCardFile || busy}
          aria-label={`${t('actions.files.download')} ${file.title}`}
          className="rounded-md border p-2 hover:bg-muted disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {failed && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {t('resourceCard.unavailable')}
        </p>
      )}
    </li>
  );
}

/** Dispatch by presentation kind, never by a plugin's business resource type. */
export function ResourceCardBlocks({
  content,
  title,
}: {
  content: ResourceCardContent[];
  title: string;
}) {
  return content.map((block, index) => {
    const label = block.title || title;
    let body: React.ReactNode;
    switch (block.kind) {
      case 'image-gallery':
        body = <ResourceCardImages images={block.images} title={label} />;
        break;
      case 'file-list':
        body = (
          <ul aria-label={label} className="divide-y">
            {block.files.map((file) => (
              <FileItem key={file.id} file={file} />
            ))}
          </ul>
        );
        break;
      case 'fields':
        body = (
          <dl
            aria-label={label}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-3 gap-y-2 text-sm"
          >
            {block.fields.map((field, fieldIndex) => (
              <React.Fragment key={fieldIndex}>
                <dt className="break-words text-muted-foreground">
                  {field.label}
                </dt>
                <dd className="whitespace-pre-wrap break-words">
                  {field.value}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        );
        break;
      default:
        return null;
    }
    return (
      <section
        key={`${block.kind}:${index}`}
        className="mt-3"
        aria-label={label}
      >
        {block.title && (
          <h4 className="mb-2 text-sm font-medium">{block.title}</h4>
        )}
        {body}
      </section>
    );
  });
}
