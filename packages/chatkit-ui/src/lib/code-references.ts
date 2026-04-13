import type { Attachment, ChatKitCodeReference } from '@xpert-ai/chatkit-types';

export type ComposerValuePayload = {
  text?: string;
  reply?: string;
  attachments?: Attachment[];
  references?: ChatKitCodeReference[];
  appendReferences?: boolean;
  selectedToolId?: string | null;
  selectedModelId?: string | null;
};

type CodeReferenceCandidate = {
  id?: unknown;
  label?: unknown;
  path?: unknown;
  text?: unknown;
  startLine?: unknown;
  endLine?: unknown;
  language?: unknown;
  taskId?: unknown;
};

function isCodeReferenceCandidate(
  value: unknown,
): value is CodeReferenceCandidate {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function toLineNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  return null;
}

export function normalizeCodeReferences(
  value: unknown,
): ChatKitCodeReference[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: ChatKitCodeReference[] = [];

  value.forEach((item) => {
    if (!isCodeReferenceCandidate(item)) {
      return;
    }

    const id = toOptionalString(item.id);
    const label = toOptionalString(item.label);
    const path = toOptionalString(item.path);
    const text = typeof item.text === 'string' ? item.text : '';
    const startLine = toLineNumber(item.startLine);
    const endLine = toLineNumber(item.endLine);
    const language = toOptionalString(item.language);
    const taskId = toOptionalString(item.taskId);

    if (!path || !text || startLine === null || endLine === null) {
      return;
    }

    normalized.push({
      ...(id ? { id } : {}),
      ...(label ? { label } : {}),
      path,
      startLine,
      endLine,
      text,
      ...(language ? { language } : {}),
      ...(taskId ? { taskId } : {}),
    });
  });

  return normalized;
}

export function getCodeReferenceKey(reference: ChatKitCodeReference): string {
  if (reference.id && reference.id.trim()) {
    return reference.id.trim();
  }
  return [
    reference.path,
    reference.startLine,
    reference.endLine,
    reference.text,
  ].join(':');
}

export function mergeCodeReferences(
  current: ChatKitCodeReference[],
  incoming: ChatKitCodeReference[],
): ChatKitCodeReference[] {
  const merged = [...current];
  const seen = new Set(current.map(getCodeReferenceKey));

  incoming.forEach((reference) => {
    const key = getCodeReferenceKey(reference);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(reference);
  });

  return merged;
}

export function getCodeReferenceRange(reference: ChatKitCodeReference): string {
  return reference.startLine === reference.endLine
    ? `${reference.startLine}`
    : `${reference.startLine}-${reference.endLine}`;
}

export function getCodeReferenceLabel(reference: ChatKitCodeReference): string {
  if (reference.label && reference.label.trim()) {
    return reference.label.trim();
  }
  const segments = reference.path.split('/');
  const fileName = segments[segments.length - 1] || reference.path;
  return `${fileName} ${getCodeReferenceRange(reference)}`;
}

function getCodeFenceLanguage(reference: ChatKitCodeReference): string {
  return reference.language?.trim() ? reference.language.trim() : '';
}

function formatSingleCodeReference(reference: ChatKitCodeReference): string {
  const location = `${reference.path}:${getCodeReferenceRange(reference)}`;
  const fenceLanguage = getCodeFenceLanguage(reference);
  return [
    `[${location}]`,
    `\`\`\`${fenceLanguage}`,
    reference.text,
    '```',
  ].join('\n');
}

export function buildCodeReferencePrompt(
  promptText: string,
  references: ChatKitCodeReference[],
): string {
  const trimmedPrompt = promptText.trim();
  if (references.length === 0) {
    return trimmedPrompt;
  }

  const referenceBody = references.map(formatSingleCodeReference).join('\n\n');
  if (!trimmedPrompt) {
    return `Referenced code:\n${referenceBody}`;
  }

  return `${trimmedPrompt}\n\nReferenced code:\n${referenceBody}`;
}

export type HumanMessageInputPayloadSource = {
  content?: string | null;
  submittedInput?: string | null;
  references?: ChatKitCodeReference[];
};

export function buildHumanMessageInputPayload(
  source: HumanMessageInputPayloadSource,
): { input: string; references?: ChatKitCodeReference[] } | null {
  const references = normalizeCodeReferences(source.references);
  const submittedInput =
    typeof source.submittedInput === 'string' ? source.submittedInput.trim() : '';

  if (submittedInput) {
    return {
      input: submittedInput,
      ...(references.length > 0 ? { references } : {}),
    };
  }

  const input = buildCodeReferencePrompt(source.content ?? '', references);
  if (!input) {
    return null;
  }

  return {
    input,
    ...(references.length > 0 ? { references } : {}),
  };
}
