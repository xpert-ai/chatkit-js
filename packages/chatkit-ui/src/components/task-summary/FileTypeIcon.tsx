import type { ChatTaskSummaryOutput } from '@xpert-ai/chatkit-types';
import { fileTypeIcons } from '../../assets/file-types/icons.generated';
import { cn } from '../../lib/utils';

type FileType = keyof typeof fileTypeIcons;
type FileMetadata = Pick<ChatTaskSummaryOutput, 'mimeType' | 'kind'>;

const mimeIcons: Readonly<Record<string, FileType>> = {
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'word',
  'application/vnd.oasis.opendocument.text': 'word',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.ms-excel.sheet.macroenabled.12': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.oasis.opendocument.spreadsheet': 'excel',
  'text/csv': 'excel',
  'text/tab-separated-values': 'excel',
  'application/vnd.ms-powerpoint': 'powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'powerpoint',
  'application/vnd.oasis.opendocument.presentation': 'powerpoint',
  'application/pdf': 'pdf',
  'application/json': 'json',
  'text/json': 'json',
  'application/ld+json': 'json',
  'text/markdown': 'markdown',
  'text/x-markdown': 'markdown',
  'text/plain': 'text',
  'text/html': 'code',
  'text/css': 'code',
  'text/javascript': 'code',
  'application/javascript': 'code',
  'application/typescript': 'code',
  'application/xml': 'code',
  'text/xml': 'code',
  'application/yaml': 'code',
  'application/x-yaml': 'code',
  'text/yaml': 'code',
  'text/x-python': 'code',
  'application/x-python-code': 'code',
  'application/sql': 'code',
  'application/x-sh': 'code',
  'application/zip': 'archive',
  'application/x-zip-compressed': 'archive',
  'application/gzip': 'archive',
  'application/x-tar': 'archive',
  'application/x-7z-compressed': 'archive',
  'application/vnd.rar': 'archive',
};

/** MIME and output kind are authoritative; display titles never determine file type. */
export function getFileIconType({ mimeType, kind }: FileMetadata): FileType {
  const mime = mimeType?.split(';', 1)[0].trim().toLowerCase();
  if (mime) {
    if (mimeIcons[mime]) return mimeIcons[mime];
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime.startsWith('video/')) return 'video';
    if (mime.endsWith('+json')) return 'json';
    if (mime.endsWith('+xml')) return 'code';
    if (mime.startsWith('text/')) return 'text';
  }
  switch (kind) {
    case 'spreadsheet':
      return 'excel';
    case 'presentation':
      return 'powerpoint';
    case 'document':
      return 'text';
    case 'image':
      return 'image';
    case 'site':
    case 'url':
      return 'web';
    default:
      return 'file';
  }
}

export function FileTypeIcon({
  output,
  variant = 'inline',
}: {
  output: FileMetadata;
  variant?: 'card' | 'inline';
}) {
  const type = getFileIconType(output);
  return (
    <span
      aria-hidden="true"
      data-file-type={type}
      className={cn(
        'chatkit-file-type-icon inline-flex shrink-0 items-center justify-center',
        variant === 'card' && 'chatkit-file-type-tile bg-muted/60',
      )}
    >
      <img
        src={fileTypeIcons[type]}
        alt=""
        width={24}
        height={24}
        draggable={false}
      />
    </span>
  );
}
