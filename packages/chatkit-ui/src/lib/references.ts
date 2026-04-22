import type {
  Attachment,
  ChatKitCodeReference,
  ChatKitImageReference,
  ChatKitQuoteReference,
  ChatKitReference,
  ChatKitReferenceCompositionMode,
} from '@xpert-ai/chatkit-types';

export type ComposerValuePayload = {
  text?: string;
  reply?: string;
  attachments?: Attachment[];
  references?: ChatKitReference[];
  appendReferences?: boolean;
  selectedToolId?: string | null;
  selectedModelId?: string | null;
};

type ReferenceCandidate = {
  id?: unknown;
  type?: unknown;
  label?: unknown;
  text?: unknown;
  path?: unknown;
  startLine?: unknown;
  endLine?: unknown;
  language?: unknown;
  taskId?: unknown;
  messageId?: unknown;
  source?: unknown;
  fileId?: unknown;
  url?: unknown;
  mimeType?: unknown;
  name?: unknown;
  size?: unknown;
  width?: unknown;
  height?: unknown;
};

type CodeReferenceCandidate = ReferenceCandidate & {
  path: string;
  startLine: number;
  endLine: number;
  text: string;
  id?: string;
  label?: string;
  language?: string;
  taskId?: string;
};

type QuoteReferenceCandidate = ReferenceCandidate & {
  type: 'quote';
  text: string;
  id?: string;
  label?: string;
  messageId?: string;
  source?: string;
};

type ImageReferenceCandidate = ReferenceCandidate & {
  type: 'image';
  text?: string;
  id?: string;
  label?: string;
  fileId?: string;
  url?: string;
  mimeType?: string;
  name?: string;
  size?: number;
  width?: number;
  height?: number;
};

type LegacyCodeReferenceCandidate = Omit<ChatKitCodeReference, 'type'> & {
  type?: unknown;
};

function isObjectLike(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function toOptionalString(value: unknown): string | undefined {
  return isNonEmptyString(value) ? value.trim() : undefined;
}

function toReferenceText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function toLineNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  return null;
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || Number.isFinite(value);
}

function toOptionalNumber(
  value: unknown,
  options?: { allowZero?: boolean },
): number | undefined {
  const allowZero = options?.allowZero ?? false;
  if (!Number.isFinite(value)) {
    return undefined;
  }

  const numberValue = value as number;
  if (numberValue > 0 || (allowZero && numberValue === 0)) {
    return numberValue;
  }

  return undefined;
}

function hasImageReferenceLocator(candidate: ReferenceCandidate): boolean {
  return (
    isNonEmptyString(candidate.fileId) ||
    isNonEmptyString(candidate.url) ||
    isNonEmptyString(candidate.name) ||
    isNonEmptyString(candidate.label) ||
    isNonEmptyString(candidate.text)
  );
}

function isCodeReferenceCandidate(
  value: unknown,
): value is CodeReferenceCandidate {
  if (!isObjectLike(value)) {
    return false;
  }

  const candidate = value as ReferenceCandidate;
  return (
    isNonEmptyString(candidate.path) &&
    toLineNumber(candidate.startLine) !== null &&
    toLineNumber(candidate.endLine) !== null &&
    toReferenceText(candidate.text) !== null &&
    isOptionalString(candidate.id) &&
    isOptionalString(candidate.label) &&
    isOptionalString(candidate.language) &&
    isOptionalString(candidate.taskId)
  );
}

function isQuoteReferenceCandidate(
  value: unknown,
): value is QuoteReferenceCandidate {
  if (!isObjectLike(value)) {
    return false;
  }

  const candidate = value as ReferenceCandidate;
  return (
    candidate.type === 'quote' &&
    toReferenceText(candidate.text) !== null &&
    isOptionalString(candidate.id) &&
    isOptionalString(candidate.label) &&
    isOptionalString(candidate.messageId) &&
    isOptionalString(candidate.source)
  );
}

function isImageReferenceCandidate(
  value: unknown,
): value is ImageReferenceCandidate {
  if (!isObjectLike(value)) {
    return false;
  }

  const candidate = value as ReferenceCandidate;
  return (
    candidate.type === 'image' &&
    isOptionalString(candidate.id) &&
    isOptionalString(candidate.label) &&
    isOptionalString(candidate.text) &&
    isOptionalString(candidate.fileId) &&
    isOptionalString(candidate.url) &&
    isOptionalString(candidate.mimeType) &&
    isOptionalString(candidate.name) &&
    isOptionalNumber(candidate.size) &&
    isOptionalNumber(candidate.width) &&
    isOptionalNumber(candidate.height) &&
    hasImageReferenceLocator(candidate)
  );
}

function toCodeReference(
  candidate: CodeReferenceCandidate,
): ChatKitCodeReference {
  return {
    type: 'code',
    ...(toOptionalString(candidate.id)
      ? { id: toOptionalString(candidate.id) }
      : {}),
    ...(toOptionalString(candidate.label)
      ? { label: toOptionalString(candidate.label) }
      : {}),
    path: candidate.path.trim(),
    startLine: candidate.startLine,
    endLine: candidate.endLine,
    text: candidate.text,
    ...(toOptionalString(candidate.language)
      ? { language: toOptionalString(candidate.language) }
      : {}),
    ...(toOptionalString(candidate.taskId)
      ? { taskId: toOptionalString(candidate.taskId) }
      : {}),
  };
}

function toQuoteReference(
  candidate: QuoteReferenceCandidate,
): ChatKitQuoteReference {
  return {
    type: 'quote',
    ...(toOptionalString(candidate.id)
      ? { id: toOptionalString(candidate.id) }
      : {}),
    ...(toOptionalString(candidate.label)
      ? { label: toOptionalString(candidate.label) }
      : {}),
    text: candidate.text,
    ...(toOptionalString(candidate.messageId)
      ? { messageId: toOptionalString(candidate.messageId) }
      : {}),
    ...(toOptionalString(candidate.source)
      ? { source: toOptionalString(candidate.source) }
      : {}),
  };
}

function toImageReference(
  candidate: ImageReferenceCandidate,
): ChatKitImageReference {
  const fileId = toOptionalString(candidate.fileId);
  const url = toOptionalString(candidate.url);
  const name = toOptionalString(candidate.name);
  const label = toOptionalString(candidate.label);
  const rawText = toReferenceText(candidate.text);
  const text = rawText ?? name ?? label ?? 'Pasted image';

  return {
    type: 'image',
    ...(toOptionalString(candidate.id)
      ? { id: toOptionalString(candidate.id) }
      : {}),
    ...(label ? { label } : {}),
    text,
    ...(fileId ? { fileId } : {}),
    ...(url ? { url } : {}),
    ...(toOptionalString(candidate.mimeType)
      ? { mimeType: toOptionalString(candidate.mimeType) }
      : {}),
    ...(name ? { name } : {}),
    ...(toOptionalNumber(candidate.size, { allowZero: true }) !== undefined
      ? { size: toOptionalNumber(candidate.size, { allowZero: true }) }
      : {}),
    ...(toOptionalNumber(candidate.width) !== undefined
      ? { width: toOptionalNumber(candidate.width) }
      : {}),
    ...(toOptionalNumber(candidate.height) !== undefined
      ? { height: toOptionalNumber(candidate.height) }
      : {}),
  };
}

function isLegacyCodeReference(
  candidate: ReferenceCandidate,
): candidate is LegacyCodeReferenceCandidate {
  return (
    candidate.type === undefined &&
    isNonEmptyString(candidate.path) &&
    toLineNumber(candidate.startLine) !== null &&
    toLineNumber(candidate.endLine) !== null &&
    toReferenceText(candidate.text) !== null
  );
}

export function normalizeReference(value: unknown): ChatKitReference | null {
  if (!isObjectLike(value)) {
    return null;
  }

  const candidate = value as ReferenceCandidate;
  const type = toOptionalString(candidate.type);

  if (type === 'code' && isCodeReferenceCandidate(candidate)) {
    return toCodeReference(candidate);
  }

  if (isQuoteReferenceCandidate(candidate)) {
    return toQuoteReference(candidate);
  }

  if (isImageReferenceCandidate(candidate)) {
    return toImageReference(candidate);
  }

  if (type === undefined && isLegacyCodeReference(candidate)) {
    return toCodeReference(candidate);
  }

  return null;
}

export function normalizeReferences(value: unknown): ChatKitReference[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeReference(item))
    .filter((item): item is ChatKitReference => item !== null);
}

function getCodeReferenceRange(reference: ChatKitCodeReference): string {
  return reference.startLine === reference.endLine
    ? `${reference.startLine}`
    : `${reference.startLine}-${reference.endLine}`;
}

function getQuoteExcerpt(reference: ChatKitQuoteReference): string {
  const normalized = reference.text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 32) {
    return normalized;
  }
  return `${normalized.slice(0, 29)}...`;
}

function getCodeReferenceLocation(reference: ChatKitCodeReference): string {
  return `${reference.path}:${getCodeReferenceRange(reference)}`;
}

function formatReferenceSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function getImageReferenceDimensions(
  reference: ChatKitImageReference,
): string | null {
  if (!reference.width || !reference.height) {
    return null;
  }

  return `${reference.width}x${reference.height}`;
}

function getImageReferenceMetaParts(
  reference: ChatKitImageReference,
): string[] {
  return [
    reference.mimeType?.trim() || null,
    getImageReferenceDimensions(reference),
    typeof reference.size === 'number'
      ? formatReferenceSize(reference.size)
      : null,
  ].filter((part): part is string => Boolean(part));
}

export function getReferenceKey(reference: ChatKitReference): string {
  if (reference.type === 'image' && reference.fileId?.trim()) {
    return `image:${reference.fileId.trim()}`;
  }

  if (reference.id && reference.id.trim()) {
    return reference.id.trim();
  }

  if (reference.type === 'code') {
    return [
      reference.type,
      reference.path,
      reference.startLine,
      reference.endLine,
      reference.text,
    ].join(':');
  }

  if (reference.type === 'image') {
    return [
      reference.type,
      reference.url ?? '',
      reference.name ?? '',
      reference.mimeType ?? '',
      reference.size ?? '',
      reference.width ?? '',
      reference.height ?? '',
      reference.text,
    ].join(':');
  }

  return [
    reference.type,
    reference.messageId ?? '',
    reference.source ?? '',
    reference.text,
  ].join(':');
}

export function mergeReferences(
  current: ChatKitReference[],
  incoming: ChatKitReference[],
): ChatKitReference[] {
  const merged = [...current];
  const seen = new Set(current.map(getReferenceKey));

  incoming.forEach((reference) => {
    const key = getReferenceKey(reference);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(reference);
  });

  return merged;
}

export function getReferenceLabel(reference: ChatKitReference): string {
  if (reference.label && reference.label.trim()) {
    return reference.label.trim();
  }

  if (reference.type === 'code') {
    const segments = reference.path.split('/');
    const fileName = segments[segments.length - 1] || reference.path;
    return `${fileName} ${getCodeReferenceRange(reference)}`;
  }

  if (reference.type === 'image') {
    return reference.name?.trim() || 'Pasted image';
  }

  if (reference.source && reference.source.trim()) {
    return reference.source.trim();
  }

  return getQuoteExcerpt(reference);
}

export function getReferenceMetaLine(
  reference: ChatKitReference,
): string | null {
  if (reference.type === 'code') {
    return getCodeReferenceLocation(reference);
  }

  if (reference.type === 'image') {
    const parts = getImageReferenceMetaParts(reference);
    return parts.length ? parts.join(' • ') : null;
  }

  if (reference.source && reference.source.trim()) {
    return getQuoteExcerpt(reference);
  }

  if (reference.messageId && reference.messageId.trim()) {
    return `Message ${reference.messageId.trim()}`;
  }

  return null;
}

export function getReferenceTitle(reference: ChatKitReference): string {
  if (reference.type === 'code') {
    return `${getCodeReferenceLocation(reference)}\n\n${reference.text}`;
  }

  if (reference.type === 'image') {
    const titleLines = [getReferenceLabel(reference)];
    const metaLine = getReferenceMetaLine(reference);
    const url =
      reference.url?.trim() && !reference.url.trim().startsWith('data:')
        ? reference.url.trim()
        : null;

    if (metaLine) {
      titleLines.push(metaLine);
    }
    if (url) {
      titleLines.push(url);
    }
    if (
      reference.text.trim() &&
      reference.text.trim() !== getReferenceLabel(reference)
    ) {
      titleLines.push('', reference.text.trim());
    }

    return titleLines.join('\n');
  }

  const header =
    reference.label?.trim() || reference.source?.trim() || 'Quoted text';
  return `${header}\n\n${reference.text}`;
}

export type HumanMessageInputPayloadSource = {
  content?: string | null;
  submittedInput?: string | null;
  references?: ChatKitReference[];
  referenceComposition?: ChatKitReferenceCompositionMode;
};

export function buildHumanMessageInputPayload(
  source: HumanMessageInputPayloadSource,
): {
  input: string;
  references?: ChatKitReference[];
  referenceComposition?: ChatKitReferenceCompositionMode;
} | null {
  const references = normalizeReferences(source.references);
  const nextReferenceComposition =
    source.referenceComposition ??
    (references.length > 0 && typeof source.submittedInput !== 'string'
      ? 'compose'
      : undefined);

  if (typeof source.submittedInput === 'string') {
    return {
      input: source.submittedInput.trim(),
      ...(references.length > 0 ? { references } : {}),
      ...(nextReferenceComposition
        ? { referenceComposition: nextReferenceComposition }
        : {}),
    };
  }

  const input = typeof source.content === 'string' ? source.content.trim() : '';
  if (!input && references.length === 0) {
    return null;
  }

  return {
    input,
    ...(references.length > 0 ? { references } : {}),
    ...(nextReferenceComposition
      ? { referenceComposition: nextReferenceComposition }
      : {}),
  };
}
