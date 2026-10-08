/** Stable provider references; credentials, temporary URLs and bytes never enter messages. */
export interface ResourceCardFileReference {
  viewKey: string;
  fileKey: string;
  targetId: string;
}

export interface ResourceCardFile {
  id: string;
  title: string;
  description?: string;
  file: ResourceCardFileReference;
}

export interface ResourceCardImage {
  id: string;
  title: string;
  alt?: string;
  file: ResourceCardFileReference;
}

export interface ResourceCardField {
  label: string;
  value: string;
}

/** Ordered presentation blocks, independent of the business resource's type. */
export type ResourceCardContent = { title?: string } & (
  | { kind: 'image-gallery'; images: ResourceCardImage[] }
  | { kind: 'file-list'; files: ResourceCardFile[] }
  | { kind: 'fields'; fields: ResourceCardField[] }
);

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseFileReference(
  value: unknown,
): ResourceCardFileReference | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('viewKey' in value) ||
    !nonempty(value.viewKey) ||
    !('fileKey' in value) ||
    !nonempty(value.fileKey) ||
    !('targetId' in value) ||
    !nonempty(value.targetId) ||
    Object.keys(value).some(
      (key) => !['viewKey', 'fileKey', 'targetId'].includes(key),
    )
  )
    return null;
  return {
    viewKey: value.viewKey,
    fileKey: value.fileKey,
    targetId: value.targetId,
  };
}

function parseFile(value: unknown): ResourceCardFile | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('id' in value) ||
    !nonempty(value.id) ||
    !('title' in value) ||
    !nonempty(value.title) ||
    !('file' in value) ||
    ('description' in value && typeof value.description !== 'string')
  )
    return null;
  const file = parseFileReference(value.file);
  if (!file) return null;
  return {
    id: value.id,
    title: value.title,
    file,
    ...('description' in value && typeof value.description === 'string'
      ? { description: value.description }
      : {}),
  };
}

function parseImage(value: unknown): ResourceCardImage | null {
  const item = parseFile(value);
  if (
    !item ||
    !value ||
    typeof value !== 'object' ||
    ('alt' in value && typeof value.alt !== 'string')
  )
    return null;
  return {
    id: item.id,
    title: item.title,
    file: item.file,
    ...('alt' in value && typeof value.alt === 'string'
      ? { alt: value.alt }
      : {}),
  };
}

function parseField(value: unknown): ResourceCardField | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('label' in value) ||
    !nonempty(value.label) ||
    !('value' in value) ||
    typeof value.value !== 'string'
  )
    return null;
  return { label: value.label, value: value.value };
}

function parseItems<T>(
  value: unknown,
  parse: (item: unknown) => T | null,
): T[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const items: T[] = [];
  for (const raw of value) {
    const item = parse(raw);
    if (!item) return null;
    items.push(item);
  }
  return items;
}

function distinctIds(items: { id: string }[]) {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function parseBlock(value: unknown): ResourceCardContent | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('kind' in value) ||
    ('title' in value && typeof value.title !== 'string')
  )
    return null;
  const title =
    'title' in value && typeof value.title === 'string'
      ? { title: value.title }
      : {};
  switch (value.kind) {
    case 'image-gallery': {
      const images =
        'images' in value ? parseItems(value.images, parseImage) : null;
      return images?.length && distinctIds(images)
        ? { kind: 'image-gallery', ...title, images }
        : null;
    }
    case 'file-list': {
      const files =
        'files' in value ? parseItems(value.files, parseFile) : null;
      return files?.length && distinctIds(files)
        ? { kind: 'file-list', ...title, files }
        : null;
    }
    case 'fields': {
      const fields =
        'fields' in value ? parseItems(value.fields, parseField) : null;
      return fields?.length ? { kind: 'fields', ...title, fields } : null;
    }
    default:
      return null;
  }
}

/** Unknown or malformed blocks never remove the resource title and navigation fallback. */
export function parseResourceCardBlocks(value: unknown): ResourceCardContent[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 32).flatMap((item) => {
    const block = parseBlock(item);
    return block ? [block] : [];
  });
}
