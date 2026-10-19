import type { ChatKitWorkbenchFileResource } from '@xpert-ai/chatkit-types';
import { downloadBlob } from '../lib/files/download';
import { isCompatiblePreviewType } from '../lib/files/file-types';
import { field, text } from './client-command-payload';
import type { ResourceFileWorkbenchPreview } from './preview/types';

export function parseFileResource(
  payload: unknown,
): ChatKitWorkbenchFileResource | null {
  const resource = field(payload, 'resource');
  const fileKey = text(field(resource, 'fileKey'));
  const targetId = field(resource, 'targetId');
  if (!fileKey || (targetId !== undefined && !text(targetId))) return null;
  return { fileKey, ...(text(targetId) ? { targetId: text(targetId) } : {}) };
}

/** Compatibility for older Views that return materialized bytes to the host. */
export function parseInlineFilePreview(
  payload: unknown,
): ResourceFileWorkbenchPreview | null {
  const url = text(field(payload, 'previewUrl') ?? field(payload, 'url'));
  if (!url) return null;
  const match =
    /^data:([a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+)(?:;charset=[a-z0-9_-]+)?;base64,([A-Za-z0-9+/]+={0,2})$/i.exec(
      url,
    );
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const name =
    text(field(payload, 'name')) ??
    text(field(payload, 'originalName')) ??
    'File';
  // Never let a misleading extension put active content in a native binary frame.
  if (!isCompatiblePreviewType(name, mimeType)) return null;
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = Uint8Array.from(atob(match[2]), (character) =>
      character.charCodeAt(0),
    );
  } catch {
    return null;
  }
  const blob = new Blob([bytes], { type: mimeType });
  const id =
    text(field(payload, 'fileAssetId')) ??
    text(field(payload, 'fileId')) ??
    text(field(payload, 'id')) ??
    crypto.randomUUID();
  return {
    kind: 'resource-file',
    key: `chatkit.preview.inline-file:${id}`,
    title: name,
    source: {
      load: async (signal) => {
        signal.throwIfAborted();
        return { blob, fileName: name };
      },
      download: async (signal) => {
        signal.throwIfAborted();
        downloadBlob(blob, name);
      },
    },
  };
}
