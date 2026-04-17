import type {
  Attachment,
  ChatKitCodeReference,
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
};

type CodeReferenceLike = Omit<ChatKitCodeReference, 'type'> & {
  type?: unknown;
};

function isObjectLike(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
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

function normalizeCodeReference(
  candidate: ReferenceCandidate,
): ChatKitCodeReference | null {
  const path = toOptionalString(candidate.path);
  const text = toReferenceText(candidate.text);
  const startLine = toLineNumber(candidate.startLine);
  const endLine = toLineNumber(candidate.endLine);

  if (!path || !text || startLine === null || endLine === null) {
    return null;
  }

  return {
    type: 'code',
    ...(toOptionalString(candidate.id)
      ? { id: toOptionalString(candidate.id) }
      : {}),
    ...(toOptionalString(candidate.label)
      ? { label: toOptionalString(candidate.label) }
      : {}),
    path,
    startLine,
    endLine,
    text,
    ...(toOptionalString(candidate.language)
      ? { language: toOptionalString(candidate.language) }
      : {}),
    ...(toOptionalString(candidate.taskId)
      ? { taskId: toOptionalString(candidate.taskId) }
      : {}),
  };
}

function normalizeQuoteReference(
  candidate: ReferenceCandidate,
): ChatKitQuoteReference | null {
  const text = toReferenceText(candidate.text);

  if (!text) {
    return null;
  }

  return {
    type: 'quote',
    ...(toOptionalString(candidate.id)
      ? { id: toOptionalString(candidate.id) }
      : {}),
    ...(toOptionalString(candidate.label)
      ? { label: toOptionalString(candidate.label) }
      : {}),
    text,
    ...(toOptionalString(candidate.messageId)
      ? { messageId: toOptionalString(candidate.messageId) }
      : {}),
    ...(toOptionalString(candidate.source)
      ? { source: toOptionalString(candidate.source) }
      : {}),
  };
}

function isLegacyCodeReference(
  candidate: ReferenceCandidate,
): candidate is CodeReferenceLike {
  return (
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

  if (type === 'code') {
    return normalizeCodeReference(candidate);
  }

  if (type === 'quote') {
    return normalizeQuoteReference(candidate);
  }

  if (type === undefined && isLegacyCodeReference(candidate)) {
    return normalizeCodeReference(candidate);
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

export function getReferenceKey(reference: ChatKitReference): string {
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

  if (reference.source && reference.source.trim()) {
    return reference.source.trim();
  }

  return getQuoteExcerpt(reference);
}

export function getReferenceMetaLine(reference: ChatKitReference): string | null {
  if (reference.type === 'code') {
    return getCodeReferenceLocation(reference);
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
