import type {
  ChatKitReferenceCompositionMode,
  ChatRequestFile,
  FollowUpBehavior,
} from '@xpert-ai/chatkit-types';
import { isRuntimeCapabilitiesSelection } from '../lib/message-metadata';
import { normalizeReferences } from '../lib/references';

export function parseContextSetPayload(payload: unknown): {
  key: string;
  clear: boolean;
  env?: Record<string, string>;
  context?: Record<string, unknown>;
} {
  if (!isObject(payload)) return { key: '', clear: false };
  const key = readString(payload, 'key') ?? '';
  const clear = Reflect.get(payload, 'clear') === true;
  const env = copyStringFields(Reflect.get(payload, 'env'));
  const contextValue = Reflect.get(payload, 'context');
  const context = isObject(contextValue)
    ? Object.fromEntries(Object.entries(contextValue))
    : undefined;
  return {
    key,
    clear,
    ...(Object.keys(env).length > 0 ? { env } : {}),
    ...(context ? { context } : {}),
  };
}

function isObject(value: unknown): value is object {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: object, key: string) {
  const field = Reflect.get(value, key);
  return typeof field === 'string' && field.trim() ? field.trim() : undefined;
}

function copyStringFields(value: unknown): Record<string, string> {
  if (!isObject(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, field] of Object.entries(value)) {
    if (typeof field === 'string') result[key] = field;
  }
  return result;
}

export function parseChatMessagePayload(payload: unknown) {
  const value = isObject(payload) ? payload : null;
  const references = normalizeReferences(
    value ? Reflect.get(value, 'references') : undefined,
  );
  const referenceCompositionValue = value
    ? Reflect.get(value, 'referenceComposition')
    : undefined;
  const referenceComposition: ChatKitReferenceCompositionMode | undefined =
    referenceCompositionValue === 'compose' ||
    referenceCompositionValue === 'preserve'
      ? referenceCompositionValue
      : undefined;
  const runtimeCapabilitiesValue = value
    ? Reflect.get(value, 'runtimeCapabilities')
    : undefined;
  const followUpModeValue = value
    ? Reflect.get(value, 'followUpMode')
    : undefined;
  const followUpMode: FollowUpBehavior | undefined =
    followUpModeValue === 'queue' || followUpModeValue === 'steer'
      ? followUpModeValue
      : undefined;
  const stateValue = value ? Reflect.get(value, 'state') : undefined;

  return {
    text: value
      ? (readString(value, 'text') ?? readString(value, 'input') ?? '')
      : '',
    files: value
      ? [
          ...parseChatRequestFiles(Reflect.get(value, 'files')),
          ...parseChatAttachments(Reflect.get(value, 'attachments')),
        ]
      : [],
    references,
    referenceComposition,
    followUpMode,
    state: isObject(stateValue)
      ? Object.fromEntries(Object.entries(stateValue))
      : undefined,
    planMode: value ? Reflect.get(value, 'planMode') === true : false,
    newThread: value ? Reflect.get(value, 'newThread') === true : false,
    clientMessageId: value ? readString(value, 'clientMessageId') : undefined,
    runtimeCapabilities: isRuntimeCapabilitiesSelection(
      runtimeCapabilitiesValue,
    )
      ? runtimeCapabilitiesValue
      : undefined,
  };
}

function parseChatAttachments(value: unknown): ChatRequestFile[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!isObject(candidate)) return [];
    const id = readString(candidate, 'id');
    const name =
      readString(candidate, 'name') ?? readString(candidate, 'originalName');
    const mimeType =
      readString(candidate, 'mime_type') ??
      readString(candidate, 'mimeType') ??
      readString(candidate, 'mimetype');
    if (!id) return [];
    return [
      {
        id,
        ...(name ? { name, originalName: name } : {}),
        ...(mimeType ? { mimeType } : {}),
        ...(readString(candidate, 'preview_url')
          ? { thumbUrl: readString(candidate, 'preview_url') }
          : {}),
      },
    ];
  });
}

function parseChatRequestFiles(value: unknown): ChatRequestFile[] {
  if (!Array.isArray(value)) return [];
  const files: ChatRequestFile[] = [];
  for (const candidate of value) {
    if (!isObject(candidate)) continue;
    const fileAssetId = readString(candidate, 'fileAssetId');
    const id = readString(candidate, 'id');
    const fileId = readString(candidate, 'fileId');
    const storageFileId = readString(candidate, 'storageFileId');
    const metadata = readChatFileMetadata(candidate);

    if (fileAssetId) {
      files.push({
        fileAssetId,
        ...(fileId ? { fileId } : {}),
        ...(storageFileId ? { storageFileId } : {}),
        ...metadata,
      });
      continue;
    }
    if (id && fileId && storageFileId) {
      files.push({ id, fileId, storageFileId, ...metadata });
      continue;
    }
    if (storageFileId) {
      files.push({ storageFileId, ...metadata });
      continue;
    }
    if (id) {
      files.push({ id, ...metadata });
    }
  }
  return files;
}

function readChatFileMetadata(value: object) {
  const name =
    readString(value, 'name') ??
    readString(value, 'originalName') ??
    readString(value, 'fileName');
  const mimeType =
    readString(value, 'mimeType') ?? readString(value, 'mimetype');
  const url = readString(value, 'url');
  const fileUrl = readString(value, 'fileUrl');
  const thumbUrl =
    readString(value, 'thumbUrl') ?? readString(value, 'previewUrl');
  const sizeValue = Reflect.get(value, 'size');
  return {
    ...(name ? { name, originalName: name } : {}),
    ...(mimeType ? { mimeType } : {}),
    ...(url ? { url } : {}),
    ...(fileUrl ? { fileUrl } : {}),
    ...(thumbUrl ? { thumbUrl } : {}),
    ...(typeof sizeValue === 'number' && Number.isFinite(sizeValue)
      ? { size: sizeValue }
      : {}),
  };
}
